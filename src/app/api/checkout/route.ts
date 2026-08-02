// route.ts

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { validateLineItems, encodeOrderItems, generateOrderNumber, type LineItem } from '@/lib/order';
import { isUnderConstruction } from '@/lib/under-construction';

export async function POST(request: Request) {
  if (isUnderConstruction()) {
    return NextResponse.json({ error: "We're under construction" }, { status: 503 });
  }
  const origin = new URL(request.url).origin;
  try {
    const body = await request.json();
    const { items } = body as { items: LineItem[] };

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

    const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: ['CA'],
      },
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
      success_url: `${origin}/checkout/success?success=true&order={CHECKOUT_SESSION_ID}&items=${itemsParam}`,
      cancel_url: `${origin}/cart?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[Checkout] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
