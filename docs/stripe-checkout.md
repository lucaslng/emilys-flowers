# Stripe Checkout

> **Read this before touching `src/app/api/checkout/route.ts`,
> `src/lib/stripe.ts`, or Stripe env wiring.** The Stripe.js client API
> changed — `redirectToCheckout` is gone — and the route creates real
> Checkout Sessions when `STRIPE_SECRET_KEY` is set.

## Current state

The checkout route at `src/app/api/checkout/route.ts` creates a **real**
Stripe Checkout Session when `STRIPE_SECRET_KEY` is set. When the key is
absent (e.g. local dev without a `.env.local`), it falls back to a simulated
success URL so `bun run dev` still works without keys. No money moves in the
fallback.

## Versions

| Package | Version | Where |
|---|---|---|
| `stripe` (server SDK) | `^22.3.2` | `src/app/api/checkout/route.ts` |
| `@stripe/stripe-js` (client SDK) | `^9.12.0` | `src/lib/stripe.ts` |

## Architecture

### Server side — Route Handler

`src/app/api/checkout/route.ts` exports a `POST` handler. The real flow:

```ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const ORIGIN =
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : 'http://localhost:3000')

export async function POST(request: Request) {
  const { items } = await request.json()

  const secretKey = process.env.STRIPE_SECRET_KEY

  // No key configured — simulate success instead of crashing.
  if (!secretKey) {
    return NextResponse.json({ url: `${ORIGIN}/cart?success=true` })
  }

  const stripe = new Stripe(secretKey)
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
    success_url: `${ORIGIN}/cart?success=true`,
    cancel_url: `${ORIGIN}/cart?canceled=true`,
  })

  return NextResponse.json({ url: session.url })
}
```

The `ORIGIN` fallback chain is what lets preview deployments work without
per-branch config: `NEXT_PUBLIC_BASE_URL` is set only in the Production
environment, previews fall through to Vercel's auto-injected
`NEXT_PUBLIC_VERCEL_URL`, and local dev defaults to `http://localhost:3000`.

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
client code). `stripePromise` is currently unused — the redirect flow only needs
the server-side `session.url` — but would be needed for embedded Checkout or
Stripe Elements.

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
| `STRIPE_SECRET_KEY` | Server — `route.ts` (`new Stripe(...)`) | `sk_live_...` (production) or `sk_test_...` (preview/dev) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client — `src/lib/stripe.ts` (`loadStripe`) | `pk_live_...` or `pk_test_...` — must match the secret key's mode |
| `NEXT_PUBLIC_BASE_URL` | Server — `route.ts` (success/cancel URLs) | Set in Production only; previews fall back to `NEXT_PUBLIC_VERCEL_URL`, local dev to `http://localhost:3000` |

### Local env files (gitignored)

- `.env` — Stripe sandbox (test-mode) keys
- `.env.live` — Stripe live (production) keys — **keep secret**
- `example.env` — template with placeholder `sk_test_xxx` / `pk_test_xxx`
  (this is the only one tracked in git)

Next.js 16 automatically loads `.env.local` and `.env` files — no extra config
needed.

## Testing with Stripe test cards

When running with sandbox (`sk_test_...`) keys, use these test cards:

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3DS: `4000 0027 6000 3184`

Any future expiry date and any CVC work in test mode.

## Vercel environment scoping

Vercel has three deployment environments, and env vars are set **per
environment** — this is what gives you live-on-prod / sandbox-on-previews
without per-branch config:

| Vercel env | Deployments | Stripe keys |
|---|---|---|
| **Production** | Your production branch (e.g. `main`) | Live (`sk_live_...` / `pk_live_...`) |
| **Preview** | Every other branch / PR | Test (`sk_test_...` / `pk_test_...`) |
| **Development** | `vercel dev` / local pulls | Test keys (or live, your call) |

Set `NEXT_PUBLIC_BASE_URL` **only** in the Production environment (your stable
domain). Leave it unset for Preview and Development — the `ORIGIN` fallback
chain in the route resolves preview URLs automatically via
`NEXT_PUBLIC_VERCEL_URL`.

Keep key pairs matched within each environment: live secret + live publishable
together, test pair together. Mixing a live secret with a test publishable (or
vice versa) will fail.

## App Router gotchas

- **Body parsing is built-in.** `request.json()` works natively in route
  handlers — no `bodyParser` config or middleware needed (unlike Pages Router).
- **POST handlers are dynamic by default.** No need for
  `export const dynamic = 'force-dynamic'` on the checkout route.
- **Return `NextResponse.json()` or `Response.json()`** — both work.
- **Always wrap `stripe.checkout.sessions.create` in try/catch** and return a
  non-200 status on failure so the client can surface an error.