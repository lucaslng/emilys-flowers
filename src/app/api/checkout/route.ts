import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const ORIGIN =
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : 'http://localhost:3000');

interface LineItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items } = body as { items: LineItem[] };

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'No items provided' },
        { status: 400 }
      );
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;

    // No secret key configured (e.g. local dev without a .env.local):
    // simulate a successful checkout instead of crashing.
    if (!secretKey) {
      console.log('[Checkout] No STRIPE_SECRET_KEY; simulating success');
      const itemSummary = items
        .map((i) => `${i.quantity}x ${i.name}`)
        .join(', ');
      const successUrl = `${ORIGIN}/cart?success=true&items=${encodeURIComponent(itemSummary)}`;
      return NextResponse.json({ url: successUrl });
    }

    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: items.map((item) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.name,
          },
          unit_amount: item.price,
        },
        quantity: item.quantity,
      })),
      success_url: `${ORIGIN}/cart?success=true`,
      cancel_url: `${ORIGIN}/cart?canceled=true`,
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
