import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  sendOrderConfirmationEmail,
  type EmailLineItem,
  type OrderConfirmationData,
} from '@/lib/email';

/**
 * Stripe webhook endpoint.
 *
 * Handles `checkout.session.completed` by sending an order confirmation email.
 * Signature verification is skipped (with a warning) when
 * `STRIPE_WEBHOOK_SECRET` is not set, so local dev works without it.
 */

// `shipping_details` is returned by the Stripe API on Checkout Sessions but is
// not yet present on the stripe-node v22 `Checkout.Session` type.
type SessionWithShippingDetails = Stripe.Checkout.Session & {
  shipping_details?: { name: string; address: Stripe.Address } | null;
};

function formatShippingAddress(session: Stripe.Checkout.Session): string | undefined {
  const shippingDetails = (session as SessionWithShippingDetails).shipping_details;
  if (!shippingDetails?.address) return undefined;

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

/**
 * Map a retrieved Checkout Session to the data needed for an order
 * confirmation email. Returns `null` when the session has no customer email.
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
    orderNumber: session.id,
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

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      console.error('[Webhook] STRIPE_SECRET_KEY is not set');
      return NextResponse.json(
        { error: 'Stripe secret key not configured' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(secretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    });

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
    } else {
      console.warn(
        '[Webhook] STRIPE_WEBHOOK_SECRET is not set; skipping signature verification (dev mode)'
      );
      event = JSON.parse(payload) as Stripe.Event;
    }

    if (event.type === 'checkout.session.completed') {
      const session = await stripe.checkout.sessions.retrieve(event.data.object.id, {
        // Only `line_items` is expandable. `customer_details` and
        // `shipping_details` are always returned on a retrieved session —
        // listing them in `expand` makes Stripe reject the request with 400.
        expand: ['line_items'],
      });

      // App-level idempotency: once the confirmation is stamped on the session,
      // never send it again — even after Resend's 24h idempotency-key window
      // expires (Stripe retries webhooks for up to ~3 days).
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
        // Non-2xx makes Stripe retry the delivery with exponential backoff
        // (same `event.id`, so Resend's idempotency key dedupes in-window
        // retries; the stamp check above dedupes later retries).
        return NextResponse.json(
          { error: 'Failed to send confirmation email' },
          { status: 500 }
        );
      }
      console.log(
        `[Webhook] Confirmation email sent for session ${session.id}: ${result.id}`
      );

      // Stamp confirmation state on the session. `sessions.update` REPLACES
      // the entire metadata map, so merge the existing keys (e.g.
      // `shipped_at` / `shipping_estimate` written later by the admin ship
      // route) rather than wiping them.
      try {
        await stripe.checkout.sessions.update(session.id, {
          metadata: {
            ...session.metadata,
            confirmation_email_sent_at: new Date().toISOString(),
            confirmation_email_id: result.id,
          },
        });
      } catch (error) {
        // Non-fatal: the email was already delivered, and returning 500 would
        // make Stripe retry and risk a duplicate confirmation once Resend's
        // 24h idempotency-key window expires.
        console.error(
          `[Webhook] Failed to stamp confirmation metadata for session ${session.id}:`,
          error
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