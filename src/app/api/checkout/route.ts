import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import {
  validateCheckoutItems,
  mergeCheckoutItems,
  generateOrderNumber,
  computeLineItemTotal,
  type CheckoutItemPayload,
  type LineItem,
} from '@/lib/order';
import { getCatalogIndex } from '@/lib/catalog-index';
import {
  isChitchatsConfigured,
  createShipment,
  pickCheapestRate,
  buildShipmentPayload,
  validateDeliveryAddress,
  type ChitChatsShipment,
} from '@/lib/chitchats';
import { shippingAddressMetadata } from '@/lib/address-validation';
import { getStripeClient } from '@/lib/stripe-client';
import { checkRateLimit } from '@/lib/rate-limit';
import { isBaseUrlConfigured, resolveBaseOrigin } from '@/lib/base-url';

export async function POST(request: Request) {
  try {
    // Malformed JSON is a client fault — clean 400, not the 500 catch below.
    let body: { items?: unknown; address?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 }
      );
    }
    const { items, address } = body;

    // Only {productId, quantity} pairs are accepted; names/prices are always
    // resolved server-side so a client-supplied price can never reach Stripe.
    const validation = validateCheckoutItems(items);
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // The server must not trust the cart's client-side merge. Validate before
    // AND after merging: merging alone could launder invalid entries whose
    // sum happens to be valid, and re-validation fails closed on summed
    // quantities over MAX_LINE_ITEM_QUANTITY.
    const mergedItems = mergeCheckoutItems(
      items as CheckoutItemPayload[]
    );
    const mergedValidation = validateCheckoutItems(mergedItems);
    if (!mergedValidation.ok) {
      return NextResponse.json(
        { error: mergedValidation.error },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    if (!stripe) {
      // Fail closed when unconfigured — there is no simulated path.
      console.error(
        '[Checkout] STRIPE_SECRET_KEY is not set; cannot create a checkout session.'
      );
      return NextResponse.json(
        { error: 'Stripe is not configured.' },
        { status: 503 }
      );
    }

    if (!isBaseUrlConfigured()) {
      // Fail closed like admin auth — redirect origins never come from the client-supplied Host header.
      console.error(
        '[Checkout] BASE_URL is not set; refusing Host-derived success/cancel URLs in production.'
      );
      return NextResponse.json(
        { error: 'Checkout is not configured.' },
        { status: 503 }
      );
    }

    // Rate-limit before any billable external call (catalog fetch, ChitChats shipment, Stripe session) — cheap rejections stay quota-free.
    // rejections above stay quota-free.
    const rateLimited = await checkRateLimit(request, 'checkout');
    if (rateLimited) {
      return rateLimited;
    }

    // Resolve every productId against the live Stripe catalog — names, price
    // ids and amounts come from Stripe, never from the request.
    const catalog = await getCatalogIndex();
    const resolved: Array<{
      productId: string;
      priceId: string;
      name: string;
      unitAmount: number;
      quantity: number;
    }> = [];
    for (const item of mergedItems) {
      const entry = catalog.get(item.productId);
      if (!entry) {
        return NextResponse.json(
          { error: `Unknown product: ${item.productId}` },
          { status: 400 }
        );
      }
      resolved.push({
        productId: item.productId,
        priceId: entry.priceId,
        name: entry.name,
        unitAmount: entry.unitAmount,
        quantity: item.quantity,
      });
    }
    // The only item list used downstream (Stripe line_items and ChitChats alike).
    const resolvedItems: LineItem[] = resolved.map((r) => ({
      id: r.productId,
      name: r.name,
      price: r.unitAmount,
      quantity: r.quantity,
    }));

    const orderNumber = generateOrderNumber();

    // Pinned to BASE_URL in production — never the Host header.
    const origin = resolveBaseOrigin(request.url);

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      billing_address_collection: 'required',
      metadata: { order_number: orderNumber },
      line_items: resolved.map((r) => ({
        price: r.priceId,
        quantity: r.quantity,
      })),
      // Session id + order number only — no display-only params; the receipt (shipping included) is retrieved server-side.
      success_url: `${origin}/checkout/success?order=${orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart?canceled=true`,
    };

    // ChitChats has no standalone rates endpoint — rates come back when a
    // shipment is created with `postage_type: "unknown"`. Fail closed: no
    // rate means checkout fails, never a silently-charged flat rate.
    if (isChitchatsConfigured()) {
      const addressValidation = validateDeliveryAddress(address);
      if (!addressValidation.ok) {
        // Per-field errors let the client form highlight exactly which
        // fields the customer must fix; the `error` string is unchanged.
        return NextResponse.json(
          {
            error: 'A delivery address is required to calculate shipping.',
            fieldErrors: addressValidation.fieldErrors,
          },
          { status: 400 }
        );
      }

      // One object feeds both the ChitChats payload and Stripe metadata, so
      // the label always matches what was stored.
      const shipping = shippingAddressMetadata(addressValidation.address);

      const subtotalCents = computeLineItemTotal(resolvedItems);
      const payload = buildShipmentPayload({
        address: shipping.value,
        items: resolvedItems,
        orderNumber,
        subtotalCents,
      });

      let shipment: ChitChatsShipment;
      try {
        shipment = await createShipment(payload);
      } catch (error) {
        console.error('[Checkout] ChitChats shipment creation failed:', error);
        return NextResponse.json(
          { error: "We couldn't calculate shipping right now. Please try again." },
          { status: 502 }
        );
      }

      const cheapest = pickCheapestRate(shipment.rates);
      if (!cheapest) {
        console.error(
          `[Checkout] ChitChats returned no rates for shipment ${shipment.id}`
        );
        return NextResponse.json(
          { error: "We couldn't calculate shipping right now. Please try again." },
          { status: 502 }
        );
      }

      // Cents come from the strict parse inside pickCheapestRate — a lenient
      // NaN→0 fallback would charge $0 shipping.
      sessionParams.shipping_options = [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: cheapest.cents, currency: 'cad' },
            display_name: cheapest.rate.postage_description,
          },
        },
      ];
      sessionParams.metadata = {
        ...sessionParams.metadata,
        order_number: orderNumber,
        chitchats_shipment_id: shipment.id,
        chitchats_tracking_url: shipment.tracking_url,
        chitchats_postage_type: cheapest.rate.postage_type,
        shipping_address: shipping.json,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[Checkout] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
