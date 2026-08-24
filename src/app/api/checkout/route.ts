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
    // Malformed JSON is a client fault, not a server one — surface it as a
    // clean 400 instead of letting it fall into the 500 catch below.
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

    // The client may only send {productId, quantity} pairs. Names, prices and
    // any other financial identifier are resolved server-side below — a
    // client-supplied price can never reach Stripe or ChitChats.
    const validation = validateCheckoutItems(items);
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Merge duplicate productIds (the cart UI does this client-side; the
    // server must not trust it). Validation runs BOTH before AND after
    // merging: merging alone first could launder invalid entries — e.g.
    // fractional or garbage quantities that happen to sum to a valid value —
    // into lines that pass validation; re-validating the merged list also
    // fails closed when summed quantities exceed MAX_LINE_ITEM_QUANTITY.
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
      // Same fail-closed stance as admin auth (issue #218): redirect origins
      // must never come from the client-supplied Host header in production.
      console.error(
        '[Checkout] BASE_URL is not set; refusing Host-derived success/cancel URLs in production.'
      );
      return NextResponse.json(
        { error: 'Checkout is not configured.' },
        { status: 503 }
      );
    }

    // Rate-limit before any billable external call (catalog fetch, ChitChats
    // shipment, Stripe session) — this unauthenticated surface creates real
    // shipments, so floods are an abuse vector (issue #209). Cheap
    // rejections above stay quota-free.
    const rateLimited = await checkRateLimit(request, 'checkout');
    if (rateLimited) {
      return rateLimited;
    }

    // Resolve every productId against the live Stripe catalog: default price
    // id, display name and unit amount all come from Stripe, never from the
    // request. Unknown products are rejected.
    const catalog = await getCatalogIndex();
    const resolved: Array<{
      productId: string;
      priceId: string;
      name: string;
      unitAmount: number;
      quantity: number;
    }> = [];
    // Iterate ONLY the merged list — duplicates must never reach Stripe as
    // separate line_items.
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
    // Catalog-resolved line items — the ONLY item list used downstream
    // (Stripe line_items and the ChitChats shipment payload alike).
    const resolvedItems: LineItem[] = resolved.map((r) => ({
      id: r.productId,
      name: r.name,
      price: r.unitAmount,
      quantity: r.quantity,
    }));

    const orderNumber = generateOrderNumber();

    // Pinned to BASE_URL in production (issue #218) — never the Host header.
    const origin = resolveBaseOrigin(request.url);

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      billing_address_collection: 'required',
      metadata: { order_number: orderNumber },
      line_items: resolved.map((r) => ({
        // Catalog-resolved Stripe Price objects — NOT inline price_data.
        price: r.priceId,
        quantity: r.quantity,
      })),
      // Session id + order number only — no display-only params; the receipt
      // (shipping included) is retrieved server-side (issue #177).
      success_url: `${origin}/checkout/success?order=${orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart?canceled=true`,
    };

    // ChitChats has no standalone rates endpoint — rates come back when a
    // shipment is created with `postage_type: "unknown"`. When configured,
    // create the shipment up front, charge the cheapest rate as the Stripe
    // shipping option, and stash the shipment id / tracking URL in metadata.
    // Fail closed: if we can't get a rate, never silently charge the old
    // flat rate.
    if (isChitchatsConfigured()) {
      const addressValidation = validateDeliveryAddress(address);
      if (!addressValidation.ok) {
        // Structured per-field errors (from the shared contract, on the
        // normalized address from the single validation pass) let the client
        // form highlight exactly which fields the customer must fix. The
        // `error` string is unchanged.
        return NextResponse.json(
          {
            error: 'A delivery address is required to calculate shipping.',
            fieldErrors: addressValidation.fieldErrors,
          },
          { status: 400 }
        );
      }

      // Build the shipping object once: `value` feeds the ChitChats payload,
      // `json` goes to Stripe metadata — the label always matches what was
      // stored, even when the 500-char fallback kicks in.
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

      // Cents come from the strict parse inside pickCheapestRate — never
      // re-parsed (a lenient NaN→0 fallback would charge $0 shipping).
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
