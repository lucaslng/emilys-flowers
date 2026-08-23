// src/app/api/admin/orders/[sessionId]/ship/route.ts
//
// Confirms an order has shipped: format-checks the sessionId path param,
// verifies the admin session cookie, looks up the Stripe checkout session for
// the customer's email/name, sends the shipping-notification email, then
// persists the confirmation on the session metadata (the admin list reads
// `shipped_at` / `shipping_estimate`).

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { sendShippedEmail } from '@/lib/email';
import { verifySessionToken } from '@/lib/admin-auth';
import { isValidCheckoutSessionId } from '@/lib/stripe-session-id';
import { clampMetadataValue } from '@/lib/address-validation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // Format guard first — never forward a crafted id to Stripe. Mirrors the
    // receipt route so malformed ids surface as a clean 400, not a raw
    // Stripe SDK error / 500.
    if (!isValidCheckoutSessionId(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid session id.' },
        { status: 400 }
      );
    }

    const adminSession = await verifySessionToken(
      request.cookies.get('admin_session')?.value
    );
    if (!adminSession) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    let body: { estimatedShippingTime?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 }
      );
    }

    // Trim + clamp to Stripe's 500-char metadata-value cap — an oversized
    // `shipping_estimate` would make the `sessions.update` below fail.
    const estimatedShippingTime =
      typeof body.estimatedShippingTime === 'string'
        ? clampMetadataValue(body.estimatedShippingTime)
        : '';
    if (!estimatedShippingTime) {
      return NextResponse.json(
        { error: 'estimatedShippingTime is required.' },
        { status: 400 }
      );
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: 'STRIPE_SECRET_KEY is not configured on the server.' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(secretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // App-level idempotency: a session with `shipped_at` already sent its
    // shipped email. Return 200 (not 409) on purpose — the client treats any
    // non-ok response as an error, and an already-shipped state is a benign
    // no-op.
    if (session.metadata?.shipped_at) {
      console.log(
        `[Admin ship] Session ${sessionId} already shipped; skipping duplicate send`
      );
      return NextResponse.json({ ok: true });
    }

    const to = session.customer_details?.email;
    if (!to) {
      throw new Error(
        `Checkout session ${sessionId} has no customer email; cannot send shipping notification.`
      );
    }

    await sendShippedEmail(
      {
        to,
        orderNumber: session.metadata?.order_number ?? session.id,
        customerName: session.customer_details?.name ?? undefined,
        estimatedShippingTime,
      },
      { idempotencyKey: `shipped-${sessionId}` }
    );

    // Stamp the shipped state. `sessions.update` REPLACES the entire metadata
    // map, so merge the existing keys — notably the webhook's
    // `confirmation_email_sent_at` / `confirmation_email_id` stamps, which are
    // the app-level dedupe guard against re-sending confirmation emails on
    // Stripe webhook retries.
    try {
      await stripe.checkout.sessions.update(sessionId, {
        metadata: {
          ...session.metadata,
          shipped_at: new Date().toISOString(),
          shipping_estimate: estimatedShippingTime,
        },
      });
    } catch (error) {
      // The shipped email was already delivered, but the failure must be
      // observable: the order is NOT stamped as shipped, so the admin has to
      // know. Within Resend's 24h idempotency window a resubmit is the safe
      // recovery path — the `shipped-${sessionId}` key dedupes the email and
      // the retry completes the missing stamp; only after 24h does a
      // resubmit risk a duplicate email.
      console.error(
        `[Admin ship] Failed to stamp shipped metadata for session ${sessionId}:`,
        error
      );
      return NextResponse.json(
        {
          error:
            'The shipped email was already sent, but saving the shipping record on the order failed. Resubmitting within 24 hours will NOT send a duplicate email — the email idempotency key dedupes it — and retries the save. After 24 hours, resubmitting COULD send a duplicate shipped email.',
          emailSent: true,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Admin ship] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}