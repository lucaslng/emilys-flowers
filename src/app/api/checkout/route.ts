// route.ts

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  validateLineItems,
  encodeOrderItems,
  generateOrderNumber,
  computeLineItemTotal,
  type LineItem,
} from '@/lib/order';
import {
  isChitchatsConfigured,
  createShipment,
  pickCheapestRate,
  parsePaymentAmountToCents,
  buildShipmentPayload,
  validateDeliveryAddress,
  type ChitChatsShipment,
} from '@/lib/chitchats';

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  try {
    const body = await request.json();
    const { items, address } = body as { items: LineItem[]; address?: unknown };

    const validation = validateLineItems(items);
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const itemsParam = encodeOrderItems(items);
    const secretKey = process.env.STRIPE_SECRET_KEY;

    // No secret key configured (e.g. local dev without a .env.local):
    // simulate a successful checkout instead of crashing.
    if (!secretKey) {
      console.log('[Checkout] No STRIPE_SECRET_KEY; simulating success');
      const order = generateOrderNumber();
      const successUrl = `${origin}/checkout/success?success=true&order=${order}&items=${itemsParam}`;
      return NextResponse.json({ url: successUrl });
    }

    const orderNumber = generateOrderNumber();
    const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      billing_address_collection: 'required',
      metadata: { order_number: orderNumber },
      line_items: items.map((item) => ({
        price_data: {
          currency: 'cad',
          product_data: {
            name: item.name,
          },
          unit_amount: item.price,
        },
        quantity: item.quantity,
      })),
      success_url: `${origin}/checkout/success?success=true&order=${orderNumber}&items=${itemsParam}`,
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
        return NextResponse.json(
          { error: 'A delivery address is required to calculate shipping.' },
          { status: 400 }
        );
      }

      const subtotalCents = computeLineItemTotal(items);
      const payload = buildShipmentPayload({
        address: addressValidation.value,
        items,
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
        shipping_address: JSON.stringify({
          name: addressValidation.value.name,
          line1: addressValidation.value.line1,
          line2: addressValidation.value.line2,
          city: addressValidation.value.city,
          province: addressValidation.value.province,
          postalCode: addressValidation.value.postalCode,
        }),
      };
      sessionParams.success_url = `${origin}/checkout/success?success=true&order=${orderNumber}&items=${itemsParam}&shipping=${shippingCents}`;
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
