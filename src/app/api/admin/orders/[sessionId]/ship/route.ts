// Sends the shipped email, then persists `shipped_at`/`shipping_estimate` on
// the Stripe session metadata (the admin list reads those stamps).

import { NextRequest, NextResponse } from 'next/server';
import { sendShippedEmail } from '@/lib/email';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/admin-auth';
import { isValidCheckoutSessionId } from '@/lib/stripe-session-id';
import { clampMetadataValue } from '@/lib/address-validation';
import { getStripeClient } from '@/lib/stripe-client';
import { isSameOriginRequest } from '@/lib/csrf';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json(
        { error: 'Cross-origin request rejected.' },
        { status: 403 }
      );
    }

    const { sessionId } = await params;

    // Format guard first — never forward a crafted id to Stripe.
    if (!isValidCheckoutSessionId(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid session id.' },
        { status: 400 }
      );
    }

    const adminSession = await verifySessionToken(
      request.cookies.get(SESSION_COOKIE)?.value
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

    // Clamp to Stripe's 500-char metadata-value cap — an oversized value
    // would make the `sessions.update` below fail.
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

    const stripe = getStripeClient();
    if (!stripe) {
      return NextResponse.json(
        { error: 'STRIPE_SECRET_KEY is not configured on the server.' },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Already-shipped is a benign no-op — 200, not 409, because the client
    // treats any non-ok response as an error.
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

    // `sessions.update` REPLACES the entire metadata map, so merge the
    // existing keys — notably the webhook's confirmation-email stamps, which
    // are the dedupe guard against re-sending on Stripe webhook retries.
    try {
      await stripe.checkout.sessions.update(sessionId, {
        metadata: {
          ...session.metadata,
          shipped_at: new Date().toISOString(),
          shipping_estimate: estimatedShippingTime,
        },
      });
    } catch (error) {
      // The email already went out but the order is NOT stamped as shipped —
      // the failure must be observable. Within Resend's 24h idempotency
      // window a resubmit dedupes the email and completes the missing stamp.
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