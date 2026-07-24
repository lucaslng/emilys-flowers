import { NextResponse } from 'next/server';

const ORIGIN = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

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

    // In a production environment, this would create a Stripe Checkout Session.
    // For development, we simulate the redirect.
    //
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    // const session = await stripe.checkout.sessions.create({
    //   mode: 'payment',
    //   line_items: items.map((item) => ({
    //     price_data: {
    //       currency: 'usd',
    //       product_data: {
    //         name: item.name,
    //       },
    //       unit_amount: item.price,
    //     },
    //     quantity: item.quantity,
    //   })),
    //   success_url: `${ORIGIN}/cart?success=true`,
    //   cancel_url: `${ORIGIN}/cart?canceled=true`,
    // });
    // return NextResponse.json({ url: session.url });

    // Simulated success for development
    console.log('[Checkout] Items received:', JSON.stringify(items, null, 2));
    console.log('[Checkout] Would redirect to Stripe Checkout');

    // Build a query string with order details for a simulated success
    const itemSummary = items
      .map((i) => `${i.quantity}x ${i.name}`)
      .join(', ');
    const successUrl = `${ORIGIN}/cart?success=true&items=${encodeURIComponent(itemSummary)}`;

    return NextResponse.json({ url: successUrl });
  } catch (error) {
    console.error('[Checkout] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
