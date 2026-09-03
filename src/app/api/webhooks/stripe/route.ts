import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  sendOrderConfirmationEmail,
  sendOwnerOrderNotificationEmail,
  type EmailLineItem,
  type OrderConfirmationData,
} from '@/lib/email';
import { stampConfirmationMetadata } from '@/lib/webhook-stamp';
import {
  formatMetadataShippingAddress,
  type SessionWithShippingDetails,
} from '@/lib/shipping-address';
import { getStripeClient } from '@/lib/stripe-client';

/**
 * Stripe webhook endpoint: sends the order confirmation email and the owner
 * order-notification email on `checkout.session.completed`. Signature
 * verification is skipped only outside production (dev convenience); a missing
 * secret in production is a hard 500.
 */

function formatShippingAddress(session: Stripe.Checkout.Session): string | undefined {
  const shippingDetails = (session as SessionWithShippingDetails).shipping_details;
  if (shippingDetails?.address) {
    const address = shippingDetails.address;
    const lines = [
      shippingDetails.name,
      address.line1,
      address.line2,
      [address.city, address.state].filter(Boolean).join(', '),
      address.postal_code,
      address.country,
    ].filter((line): line is string => Boolean(line));

    return lines.length > 0 ? lines.join('\n') : undefined;
  }

  // Stripe's `shipping_details` is null (address is collected on our own
  // checkout page) — fall back to the metadata JSON stored at checkout time.
  return formatMetadataShippingAddress(session.metadata, '\n', 'CA') ?? undefined;
}

/**
 * Maps a retrieved Checkout Session to confirmation-email data; `null` when
 * the session has no customer email.
 */
export function mapCheckoutSessionToConfirmation(
  session: Stripe.Checkout.Session
): OrderConfirmationData | null {
  const email = session.customer_details?.email;
  if (!email) return null;

  const items: EmailLineItem[] = (session.line_items?.data ?? []).map((lineItem) => ({
    name: lineItem.description ?? 'Item',
    quantity: lineItem.quantity ?? 1,
    unitAmountCents:
      lineItem.price?.unit_amount ??
      Math.round(lineItem.amount_total / (lineItem.quantity ?? 1)),
  }));

  return {
    to: email,
    orderNumber: session.metadata?.order_number ?? session.id,
    customerName: session.customer_details?.name ?? undefined,
    items,
    subtotalCents: session.amount_subtotal ?? 0,
    shippingCents: session.total_details?.amount_shipping ?? 0,
    totalCents: session.amount_total ?? 0,
    shippingAddress: formatShippingAddress(session),
  };
}

export async function POST(request: Request) {
  try {
    const payload = await request.text();
    const sig = request.headers.get('stripe-signature');

    const stripe = getStripeClient();
    if (!stripe) {
      console.error('[Webhook] STRIPE_SECRET_KEY is not set');
      return NextResponse.json(
        { error: 'Stripe secret key not configured' },
        { status: 500 }
      );
    }

    let event: Stripe.Event;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret) {
      try {
        event = await stripe.webhooks.constructEventAsync(payload, sig ?? '', webhookSecret);
      } catch (error) {
        console.error('[Webhook] Signature verification failed:', error);
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 400 }
        );
      }
    } else if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[Webhook] STRIPE_WEBHOOK_SECRET is not set; skipping signature verification (dev mode)'
      );
      event = JSON.parse(payload) as Stripe.Event;
    } else {
      console.error('[Webhook] STRIPE_WEBHOOK_SECRET is not set');
      return NextResponse.json(
        { error: 'Stripe webhook secret not configured' },
        { status: 500 }
      );
    }

    if (event.type === 'checkout.session.completed') {
      const session = await stripe.checkout.sessions.retrieve(event.data.object.id, {
        // Only `line_items` is expandable — listing the always-returned
        // `customer_details`/`shipping_details` makes Stripe reject with 400.
        expand: ['line_items'],
      });

      // Async payment methods can fire this event before the payment settles;
      // only paid sessions get an email (matches the admin order list). 200 so
      // Stripe doesn't retry.
      if (session.payment_status !== 'paid') {
        console.log(
          `[Webhook] Session ${session.id} not yet paid (payment_status: ${session.payment_status}); skipping confirmation email`
        );
        return NextResponse.json({ received: true });
      }

      // App-level idempotency: never re-send even after Resend's 24h
      // idempotency-key window expires (Stripe retries webhooks for ~3 days).
      if (session.metadata?.confirmation_email_sent_at) {
        console.log(
          `[Webhook] Confirmation already sent for session ${session.id}; skipping`
        );
        return NextResponse.json({ received: true });
      }

      const confirmation = mapCheckoutSessionToConfirmation(session);
      if (!confirmation) {
        console.warn(
          `[Webhook] No customer email on session ${session.id}; skipping confirmation email`
        );
        return NextResponse.json({ received: true });
      }

      let result: { id: string };
      try {
        result = await sendOrderConfirmationEmail(confirmation, {
          idempotencyKey: event.id,
        });
      } catch (error) {
        console.error(
          `[Webhook] Failed to send confirmation email for session ${session.id}:`,
          error
        );
        // Non-2xx makes Stripe retry; Resend's idempotency key dedupes
        // in-window retries and the stamp check dedupes later ones.
        return NextResponse.json(
          { error: 'Failed to send confirmation email' },
          { status: 500 }
        );
      }
      console.log(
        `[Webhook] Confirmation email sent for session ${session.id}: ${result.id}`
      );

      // Owner send must precede the stamp: on failure the 500 retry re-attempts it before the stamp check skips both sends.
      const { to: customerEmail, ...order } = confirmation;
      try {
        await sendOwnerOrderNotificationEmail(
          { ...order, customerEmail },
          { idempotencyKey: `owner-${event.id}` }
        );
      } catch (error) {
        console.error(
          `[Webhook] Failed to send owner notification email for session ${session.id}:`,
          error
        );
        return NextResponse.json(
          { error: 'Failed to send owner notification email' },
          { status: 500 }
        );
      }

      const stamp = await stampConfirmationMetadata(
        (metadata) => stripe.checkout.sessions.update(session.id, { metadata }),
        session.metadata,
        result.id
      );
      if (!stamp.ok) {
        console.error(
          `[Webhook] Failed to stamp confirmation metadata for session ${session.id}:`,
          stamp.error
        );
        // Non-2xx so Stripe redelivers; Resend's idempotency key dedupes
        // in-window retries and the stamp check dedupes later ones.
        return NextResponse.json(
          { error: 'Failed to stamp confirmation metadata' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}