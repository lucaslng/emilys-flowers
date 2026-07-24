# Stripe Checkout

> **Read this before touching `src/app/api/checkout/route.ts`,
> `src/lib/stripe.ts`, or enabling real payments.** The Stripe.js client API
> changed — `redirectToCheckout` is gone — and the project is currently
> stubbed.

## Current state: stubbed

The checkout route at `src/app/api/checkout/route.ts` **simulates** a
successful checkout. The real `stripe.checkout.sessions.create` call is
**commented out**, and the handler returns a fake success URL. No money moves.

This is intentional for local development. To enable real payments, see
[Enabling real payments](#enabling-real-payments) below.

## Versions

| Package | Version | Where |
|---|---|---|
| `stripe` (server SDK) | `^22.3.2` | `src/app/api/checkout/route.ts` |
| `@stripe/stripe-js` (client SDK) | `^9.12.0` | `src/lib/stripe.ts` |

## Architecture

### Server side — Route Handler

`src/app/api/checkout/route.ts` exports a `POST` handler. The real (uncommented)
flow:

```ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  const { items } = await request.json()

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: items.map((item: { name: string; price: number; quantity: number }) => ({
      price_data: {
        currency: 'usd',
        product_data: { name: item.name },
        unit_amount: item.price,  // integer cents — Stripe convention
      },
      quantity: item.quantity,
    })),
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cart?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cart?canceled=true`,
  })

  return NextResponse.json({ url: session.url })
}
```

### Client side — redirect

`src/app/checkout/page.tsx` POSTs the cart to `/api/checkout` and redirects:

```ts
const res = await fetch('/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ items: cartItems }),
})
const { url } = await res.json()
if (url) window.location.href = url  // redirect to Stripe Checkout
```

### `src/lib/stripe.ts`

Loads the client SDK:

```ts
import { loadStripe } from '@stripe/stripe-js'
export const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
```

This file has no `'use client'` directive but runs client-side (imported only by
client code). `stripePromise` is currently unused in the stubbed flow but would
be needed for embedded Checkout or Stripe Elements.

## ⚠️ `redirectToCheckout` is removed

The client-side `stripe.redirectToCheckout({ sessionId })` method **no longer
exists** in `@stripe/stripe-js` 9.x. An agent trained on older Stripe.js will
reach for it — don't.

**The correct pattern** (used by this project): create a Checkout Session
server-side, return `session.url`, and redirect with `window.location.href =
url`. This is a full-page redirect to Stripe-hosted Checkout.

If you need inline/embedded Checkout instead of a redirect, use the Embedded
Checkout API (`stripe.initEmbeddedCheckout` with `clientSecret`), but that's a
bigger change and not currently wired.

## Prices are integer cents

Stripe requires `unit_amount` in the smallest currency unit (cents for USD).
This project stores all prices as integer cents throughout (`2499` = $24.99),
so `item.price` can be passed directly to `unit_amount`. **Do not divide by 100
before sending to Stripe.** See `AGENTS.md` → "Data & state" for the full cents
convention.

## Environment variables

| Variable | Where used | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Server — `route.ts` (`new Stripe(...)`) | `sk_live_...` or `sk_test_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client — `src/lib/stripe.ts` (`loadStripe`) | `pk_live_...` or `pk_test_...` |
| `NEXT_PUBLIC_BASE_URL` | Server — `route.ts` (success/cancel URLs) | Defaults to `http://localhost:3000` |

### Local env files (gitignored)

- `.env` — Stripe sandbox (test-mode) keys
- `.env.live` — Stripe live (production) keys — **keep secret**
- `example.env` — template with placeholder `sk_test_xxx` / `pk_test_xxx`
  (this is the only one tracked in git)

Next.js 16 automatically loads `.env.local` and `.env` files — no extra config
needed.

## Enabling real payments

1. **Set environment variables** in `.env` (test mode) or `.env.live` (live):
   ```
   STRIPE_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   NEXT_PUBLIC_BASE_URL=http://localhost:3000  # or your production URL
   ```

2. **Uncomment the Stripe block** in `src/app/api/checkout/route.ts`. The
   commented code shows the real `stripe.checkout.sessions.create` call. Remove
   the fake-URL fallback.

3. **Handle the build without env vars.** If env vars aren't set during
   `bun run build` (e.g., CI), `new Stripe(undefined)` will throw. Guard it:
   ```ts
   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_placeholder')
   ```
   The placeholder lets the module load; the route will fail at request time if
   the real key is missing (which is correct — you want a clear error, not a
   build failure).

4. **Test the full flow** locally with test cards:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - 3DS: `4000 0027 6000 3184`

5. **Update `AGENTS.md`** — the Stripe section says "currently stubbed." If you
   enable real payments, update that section to reflect the new state.

## App Router gotchas

- **Body parsing is built-in.** `request.json()` works natively in route
  handlers — no `bodyParser` config or middleware needed (unlike Pages Router).
- **POST handlers are dynamic by default.** No need for
  `export const dynamic = 'force-dynamic'` on the checkout route.
- **Return `NextResponse.json()` or `Response.json()`** — both work.
- **Always wrap `stripe.checkout.sessions.create` in try/catch** and return a
  non-200 status on failure so the client can surface an error.