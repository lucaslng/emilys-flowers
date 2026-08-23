// route.ts

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  validateCheckoutItems,
  encodeOrderItems,
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
  parsePaymentAmountToCents,
  buildShipmentPayload,
  validateDeliveryAddress,
  type ChitChatsShipment,
} from '@/lib/chitchats';
import {
  validateDeliveryAddressFields,
  truncateDeliveryAddress,
  shippingAddressMetadataValue,
  type AddressFieldError,
  type ValidatedDeliveryAddress,
} from '@/lib/address-validation';

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  try {
    const body = await request.json();
    const { items, address } = body as {
      items?: unknown;
      address?: unknown;
    };

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

    const secretKey = process.env.STRIPE_SECRET_KEY;

    // No secret key configured (e.g. local dev without a .env.local):
    // simulate a successful checkout instead of crashing. Simulated mode is
    // DEGRADED: it still emits an `items=` success URL for E2E synthetic-URL
    // compatibility, but the payload shape ({productId, quantity}) no longer
    // decodes to line items (decodeOrderItems requires id/name/price), so the
    // simulated success page renders the generic confirmation WITHOUT an
    // itemized receipt. Real success URLs carry no product data at all.
    if (!secretKey) {
      console.log('[Checkout] No STRIPE_SECRET_KEY; simulating success');
      const order = generateOrderNumber();
      const itemsParam = encodeOrderItems(items as LineItem[]);
      const successUrl = `${origin}/checkout/success?success=true&order=${order}&items=${itemsParam}`;
      return NextResponse.json({ url: successUrl });
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
    for (const item of items as CheckoutItemPayload[]) {
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
    const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      billing_address_collection: 'required',
      metadata: { order_number: orderNumber },
      line_items: resolved.map((r) => ({
        // Catalog-resolved Stripe Price objects — NOT inline price_data.
        price: r.priceId,
        quantity: r.quantity,
      })),
      // Real success URLs carry only the session id; the receipt is retrieved
      // server-side by /api/checkout/session using it.
      success_url: `${origin}/checkout/success?success=true&order=${orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
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
        // Structured per-field errors (from the shared contract, on the raw
        // request address) let the client form highlight exactly which
        // fields the customer must fix. The `error` string is unchanged.
        const fieldErrors: AddressFieldError[] =
          validateDeliveryAddressFields(address);
        return NextResponse.json(
          {
            error: 'A delivery address is required to calculate shipping.',
            fieldErrors,
          },
          { status: 400 }
        );
      }

      // Clamp the validated address, then serialize it ONCE into the exact
      // string that will be stored as Stripe metadata. BOTH the ChitChats
      // payload and the metadata derive from that same serialized value (the
      // payload address is parsed back out of it), so the physical label
      // always matches what was stored — including the pathological fallback
      // path where `shippingAddressMetadataValue` drops `line2` or shortens
      // fields to fit Stripe's 500-char metadata cap.
      const shippingAddress = truncateDeliveryAddress(addressValidation.value);
      const shippingAddressMetadata = shippingAddressMetadataValue(
        shippingAddress
      );
      const storedAddress = JSON.parse(
        shippingAddressMetadata
      ) as ValidatedDeliveryAddress;

      const subtotalCents = computeLineItemTotal(resolvedItems);
      const payload = buildShipmentPayload({
        address: storedAddress,
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

      const rate = pickCheapestRate(shipment.rates);
      if (!rate) {
        console.error(
          `[Checkout] ChitChats returned no rates for shipment ${shipment.id}`
        );
        return NextResponse.json(
          { error: "We couldn't calculate shipping right now. Please try again." },
          { status: 502 }
        );
      }

      const shippingCents = parsePaymentAmountToCents(rate.payment_amount);

      sessionParams.shipping_options = [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: shippingCents, currency: 'cad' },
            display_name: rate.postage_description,
          },
        },
      ];
      sessionParams.metadata = {
        ...sessionParams.metadata,
        order_number: orderNumber,
        chitchats_shipment_id: shipment.id,
        chitchats_tracking_url: shipment.tracking_url,
        chitchats_postage_type: rate.postage_type,
        // The exact serialized value the ChitChats payload was built from —
        // hard-guaranteed to fit Stripe's 500-char metadata cap (an
        // over-long value would make session creation throw after the
        // customer filled the form).
        shipping_address: shippingAddressMetadata,
      };
      sessionParams.success_url = `${origin}/checkout/success?success=true&order=${orderNumber}&session_id={CHECKOUT_SESSION_ID}&shipping=${shippingCents}`;
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
