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
// `image` is a same-origin path only: either the build-time product photo
// manifest (PRODUCT_IMAGES) or a /placeholders/*.svg fallback.

import { NextResponse } from 'next/server';
import Stripe from 'stripe';

import { checkRateLimit } from '@/lib/rate-limit';
import { resolveReceiptImage } from '@/lib/receipt-images';

/** Only real Stripe Checkout session ids may reach the API. */
const SESSION_ID_PATTERN = /^cs_(live|test)_[A-Za-z0-9]+$/;

export async function GET(request: Request) {
  try {
    const sessionId =
      new URL(request.url).searchParams.get('session_id') ?? '';

    // Format guard first — never forward a crafted id to Stripe.
    if (!SESSION_ID_PATTERN.test(sessionId)) {
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
    // already rejected above and must not consume quota.
    const rateLimited = await checkRateLimit(request);
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
      // Resolve the display name once; it drives both the label and the
      // image lookup (which slugifies it against the build-time manifest).
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
    console.error('[CheckoutSession] Error:', error);
    return NextResponse.json(
      { error: 'Could not retrieve your order.' },
      { status: 500 }
    );
  }
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

/**
 * Category for the image fallback, from the expanded product's metadata.
 * Only 'bouquet' is honored — anything else (or absent) falls back to flower,
 * so arbitrary metadata can never shape a response path.
 */
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
