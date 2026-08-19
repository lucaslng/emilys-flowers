// src/app/api/admin/orders/[sessionId]/ship/route.ts
//
// Confirms an order has shipped: verifies the admin session cookie, looks up
// the Stripe checkout session for the customer's email/name, sends the
// shipping-notification email, then persists the confirmation on the session
// metadata (the admin list reads `shipped_at` / `shipping_estimate`).

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { sendShippedEmail } from '@/lib/email';
import { verifySessionToken } from '@/lib/admin-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

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

    const estimatedShippingTime =
      typeof body.estimatedShippingTime === 'string'
        ? body.estimatedShippingTime.trim()
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
      // Non-fatal: the email was already delivered. Returning an error here
      // would make the admin retry and risk a duplicate shipped email once
      // Resend's 24h idempotency-key window expires.
      console.error(
        `[Admin ship] Failed to stamp shipped metadata for session ${sessionId}:`,
        error
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