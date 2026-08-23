// src/app/api/checkout/session/route.ts
//
// GET /api/checkout/session?session_id=cs_...
//
// Checkout-success retrieval surface. The real checkout success URL carries
// only `session_id={CHECKOUT_SESSION_ID}` (no product data), so the success
// page fetches its receipt here: the session id is format-checked BEFORE any
// Stripe call, the session + line items are retrieved from Stripe, and ONLY a
// sanitized projection is returned:
//
//   { items: [{name, image, quantity, unitAmount}], subtotal, shipping, total, orderNumber }
//
// customer_details and metadata are NEVER returned — the browser must not
// learn the customer's contact details or the shipment/address metadata.
//
// A format-valid id Stripe doesn't know maps to 404 (missing resource), not
// 500 — other Stripe failures stay 500.
// `image` is always a same-origin path (build-time manifest or placeholder).

import { NextResponse } from 'next/server';
import Stripe from 'stripe';

import { checkRateLimit } from '@/lib/rate-limit';
import { resolveReceiptImage } from '@/lib/receipt-images';
import { isValidCheckoutSessionId } from '@/lib/stripe-session-id';

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

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: 'Stripe is not configured.' },
        { status: 503 }
      );
    }

    // Rate-limit only requests that would reach Stripe — malformed ids are
    // already rejected above and must not consume quota. Surface-prefixed
    // key keeps this bucket separate from POST /api/checkout's.
    const rateLimited = await checkRateLimit(request, 'checkout-session');
    if (rateLimited) {
      return rateLimited;
    }

    const stripe = new Stripe(secretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items.data.price.product'],
    });

    const lineItems = session.line_items?.data ?? [];
    const items = lineItems.map((lineItem) => {
      // One name drives both the label and the image lookup.
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
    // A format-valid id Stripe doesn't know (expired, other key, or crafted)
    // is a missing resource, not a server fault — answer 404 so clients get
    // correct semantics and we don't log phantom 5s.
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

/**
 * Display name for a retrieved line item. Prefers the expanded product name;
 * falls back to the line item description Stripe generated at purchase time.
 */
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
