// Success-receipt retrieval: returns only a sanitized projection of the Stripe
// session — never customer_details or metadata.

import { NextResponse } from 'next/server';
import Stripe from 'stripe';

import { checkRateLimit } from '@/lib/rate-limit';
import { resolveReceiptImage } from '@/lib/receipt-images';
import { isValidCheckoutSessionId } from '@/lib/stripe-session-id';
import { getStripeClient } from '@/lib/stripe-client';

export async function GET(request: Request) {
  try {
    const sessionId =
      new URL(request.url).searchParams.get('session_id') ?? '';

    // Format guard first — never forward a crafted id to Stripe.
    if (!isValidCheckoutSessionId(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid session id.' },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured.' },
        { status: 503 }
      );
    }

    // Rate-limit only requests that would reach Stripe; the surface-prefixed
    // key keeps this bucket separate from POST /api/checkout's.
    const rateLimited = await checkRateLimit(request, 'checkout-session');
    if (rateLimited) {
      return rateLimited;
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items.data.price.product'],
    });

    const lineItems = session.line_items?.data ?? [];
    const items = lineItems.map((lineItem) => {
      const name = resolveLineItemName(lineItem);
      return {
        name,
        image: resolveReceiptImage(name, resolveLineItemCategory(lineItem)),
        quantity: lineItem.quantity ?? 0,
        unitAmount: lineItem.price?.unit_amount ?? 0,
      };
    });

    const subtotal =
      session.amount_subtotal ??
      items.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0);
    const shipping = session.total_details?.amount_shipping ?? 0;
    const total = session.amount_total ?? subtotal + shipping;

    return NextResponse.json({
      items,
      subtotal,
      shipping,
      total,
      orderNumber: session.metadata?.order_number ?? '',
    });
  } catch (error) {
    // A format-valid id Stripe doesn't know is a missing resource, not a
    // server fault — 404 avoids phantom 5s.
    if (isStripeResourceMissing(error)) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    console.error('[CheckoutSession] Error:', error);
    return NextResponse.json(
      { error: 'Could not retrieve your order.' },
      { status: 500 }
    );
  }
}

/** True when Stripe reports the requested resource does not exist. */
function isStripeResourceMissing(error: unknown): boolean {
  return (
    error instanceof Stripe.errors.StripeInvalidRequestError &&
    error.code === 'resource_missing'
  );
}

/** Prefers the expanded product name; falls back to Stripe's purchase-time description. */
function resolveLineItemName(lineItem: Stripe.LineItem): string {
  const product = lineItem.price?.product;
  if (
    product &&
    typeof product === 'object' &&
    !('deleted' in product) &&
    typeof product.name === 'string'
  ) {
    return product.name;
  }
  return lineItem.description ?? 'Your order';
}

// Only 'bouquet' is honored so arbitrary metadata can't shape a response path.
function resolveLineItemCategory(lineItem: Stripe.LineItem): string | undefined {
  const product = lineItem.price?.product;
  if (
    product &&
    typeof product === 'object' &&
    !('deleted' in product) &&
    product.metadata?.category === 'bouquet'
  ) {
    return 'bouquet';
  }
  return undefined;
}
