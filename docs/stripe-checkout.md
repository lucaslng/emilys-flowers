# Stripe Checkout

> **Read this before touching `src/app/api/checkout/route.ts`
> or Stripe env wiring.** The Stripe.js client API
> changed — `redirectToCheckout` is gone — and the route creates real
> Checkout Sessions when `STRIPE_SECRET_KEY` is set.

## Current state

The checkout route at `src/app/api/checkout/route.ts` creates a **real**
Stripe Checkout Session when `STRIPE_SECRET_KEY` is set. When the key is
absent it fails closed with a `503 { error: 'Stripe is not configured.' }` —
there is no simulated checkout path. Local dev needs a test key in `.env`
(the build-time catalog fetch requires one anyway).

## Versions

| Package | Version | Where |
|---|---|---|
| `stripe` (server SDK) | `^22.3.2` | `src/app/api/checkout/route.ts` |

`@stripe/stripe-js` (client SDK) is **not installed** — there is no client-side
Stripe call site. Re-add it (with a real call site) when wiring Embedded Checkout
or Stripe Elements.

## Architecture

### Server side — Route Handler

`src/app/api/checkout/route.ts` exports a `POST` handler. The client sends
only `{productId, quantity}` pairs; the route resolves everything else from
the Stripe catalog. The real flow:

```ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { validateCheckoutItems } from '@/lib/order'
import { getCatalogIndex } from '@/lib/catalog-index'

export async function POST(request: Request) {
  const origin = new URL(request.url).origin
  const { items, address } = await request.json()

  // items: [{productId, quantity}] only — no client-supplied prices/names.
  const validation = validateCheckoutItems(items)
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })

  const secretKey = process.env.STRIPE_SECRET_KEY

  // No key configured — fail closed (503). There is no simulated path.
  if (!secretKey) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 })
  }

  // Resolve productIds against the live Stripe catalog (module-memoized).
  const catalog = await getCatalogIndex()
  const lineItems = []
  for (const item of items) {
    const entry = catalog.get(item.productId)
    if (!entry) {
      return NextResponse.json({ error: `Unknown product: ${item.productId}` }, { status: 400 })
    }
    lineItems.push({ price: entry.priceId, quantity: item.quantity })
  }

  const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() })
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    billing_address_collection: 'required',
    metadata: { order_number },
    line_items: lineItems,          // Stripe Price objects — NOT inline price_data
    success_url: `${origin}/checkout/success?success=true&order=${orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cart?canceled=true`,
  })

  return NextResponse.json({ url: session.url })
}
```

Key invariants:

- **No client-supplied financial identifier exists anywhere in the request
  path.** Prices, names and price ids come from the catalog index; unknown
  product ids get a 400. Quantities are capped at 99 per line server-side.
- **Requests are bounded server-side.** At most 20 distinct lines per request
  (`MAX_LINE_ITEMS`); more gets a 400 "Too many line items". Duplicate
  productIds are merged server-side (quantities summed, first-seen order kept)
  before catalog resolution and pricing, so one product can never reach Stripe
  as multiple line_items. A merged line exceeding 99 units is rejected with a
  400 "Invalid line item".
- **The ChitChats shipment payload is built from the same resolved items** —
  declared customs/insurance value and package descriptions never come from
  the client.
- **Real success URLs carry only `session_id={CHECKOUT_SESSION_ID}`.** The
  success page retrieves its receipt from `GET /api/checkout/session`
  (`src/app/api/checkout/session/route.ts`), which format-checks the id
  against `^cs_(live|test)_` before calling Stripe and returns ONLY a
  sanitized projection (`items/subtotal/shipping/total/orderNumber`) — never
  `customer_details` or metadata. Each projected item is
  `{name, image, quantity, unitAmount}`, where `image` is a same-origin path:
  `resolveReceiptImage` (`src/lib/receipt-images.ts`) slugifies the item name
  against the build-time `PRODUCT_IMAGES` manifest (scanned from
  `public/products/<slug>/` in `next.config.ts`) and falls back to the
  category placeholder SVG. No other product data or metadata is exposed.
- **Both checkout API routes are rate-limited** (`src/lib/rate-limit.ts`) at
  10 requests / 60 s per client IP via the Workers `RATE_LIMITER` ratelimit
  binding, guarding Stripe/ChitChats quota. `POST /api/checkout` is limited
  just before the first billable external call (issue #209 — it creates real
  ChitChats shipments and is unauthenticated); `GET /api/checkout/session` is
  limited only after the session-id format guard, so malformed ids stay
  quota-free. Limiter keys are surface-prefixed (`checkout:${ip}`,
  `checkout-session:${ip}`) so each route has its own bucket — receipt-page
  refreshes can't lock a client out of checkout. Exceeding either limit
  returns 429 with `Retry-After: 60`. The guard is a graceful no-op wherever
  the binding doesn't exist (local dev, Node runtime, tests) and fails open
  if the limiter itself errors — availability beats quota protection.

The `origin` is derived from `request.url` — the Worker knows its own host
from the incoming request, so there is no `NEXT_PUBLIC_BASE_URL` /
`NEXT_PUBLIC_VERCEL_URL` fallback chain (those were removed with the Vercel
migration). This works on every deployment target: `localhost:3000` in dev,
the `*.workers.dev` preview URL, and the production custom domain.

`Stripe.createFetchHttpClient()` is required on Cloudflare Workers — the
default Node.js `http`-based client does not run in the Workers runtime, so
the SDK must use the `fetch`-based client. This call is a no-op on Node.js
(`bun run start` / E2E), so it's safe unconditionally.

### Client side — redirect

`src/app/(store)/checkout/checkout-page-client.tsx` POSTs the cart to
`/api/checkout` and redirects:

```ts
const res = await fetch('/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
    address,
  }),
})
const { url } = await res.json()
if (url) window.location.href = url  // redirect to Stripe Checkout
```

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

## `Permissions-Policy: payment` — only matters for embedded integrations

The merchant origin's `Permissions-Policy` header is **per-origin** and does
not propagate across a full-page redirect. Because the current flow redirects
to `checkout.stripe.com` (Stripe's own origin, which serves its own headers),
the merchant's `Permissions-Policy` has **zero effect** on whether Apple Pay /
Google Pay work there. That's why `next.config.ts` deliberately **omits** the
`payment` directive — `payment=(self)` would be a no-op (it's the browser
default anyway) and would falsely imply the merchant origin uses the Payment
Request API. It doesn't.

**If you migrate to Stripe Elements / Express Checkout Element / Embedded
Checkout** (any integration where Stripe's payment UI renders on the merchant
origin, typically inside an iframe), this changes:

- Stripe's iframes need access to the Payment Request API on the merchant
  origin to show Apple Pay / Google Pay.
- The containing iframe must carry `allow="payment"` (or `allow="payment *"`
  for the Payment Request Button Element) — Stripe manages this on the
  iframes it injects, but only if the merchant origin doesn't block it.
- At that point, ensure `Permissions-Policy` does **not** set `payment=()` on
  the merchant origin. Either omit `payment` (defaults to `self`) or set
  `payment=(self)` explicitly. Do **not** use `payment=()` — it would break
  Apple Pay / Google Pay in the embedded flow.

Until that migration happens, leave `payment` out of `Permissions-Policy`.
See Stripe's Apple Pay and Express Checkout Element docs for the iframe
`allow` attribute details.

## Prices are integer cents

Stripe requires `unit_amount` in the smallest currency unit (cents for CAD).
This project stores all prices as integer cents throughout (`2499` = $24.99),
so `item.price` can be passed directly to `unit_amount`. **Do not divide by 100
before sending to Stripe.** See `AGENTS.md` → "Data & state" for the full cents
convention.

## Environment variables

| Variable | Where used | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Server — `route.ts` (`new Stripe(...)`) | `sk_live_...` (production) or `sk_test_...` (preview/dev) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No code consumer (reserved for future client-side Stripe SDK) | `pk_live_...` or `pk_test_...` — must match the secret key's mode when wired in |
| `STRIPE_WEBHOOK_SECRET` | Server — `src/app/api/webhooks/stripe/route.ts` | `whsec_...`; signs `checkout.session.completed` events. Optional in dev (verification skipped with a warning), required in prod. See [order-emails.md](./order-emails.md). |

There is **no `NEXT_PUBLIC_BASE_URL`** — the route derives `origin` from
`request.url`, so success/cancel URLs resolve automatically on every host
(localhost, `*.workers.dev`, custom domain).

### Local env files (gitignored)

- `.env` / `.env.local` — read by `next dev`; Stripe sandbox (test-mode) keys
- `.dev.vars` — read by `wrangler dev` / `bun run preview` (Workers runtime)
- `example.env` — template with placeholder `sk_test_xxx` / `pk_test_xxx`
  (this is the only env file tracked in git)

Next.js 16 automatically loads `.env.local` and `.env` files — no extra config
needed for `bun run dev`. For `bun run preview` (Miniflare), use `.dev.vars`.

## Testing with Stripe test cards

When running with sandbox (`sk_test_...`) keys, use these test cards:

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3DS: `4000 0027 6000 3184`

Any future expiry date and any CVC work in test mode.

## Cloudflare Workers secret management

On Cloudflare Workers, env vars are **not** scoped per-environment the way
Vercel does it. There is one deployed Worker, and secrets are attached to it
directly.

| Variable | Local dev | Production (runtime) | Production (build-time) |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | `.env.local` or `.dev.vars` | `wrangler secret put STRIPE_SECRET_KEY` | N/A (server-only) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `.env.local` or `.dev.vars` | `wrangler secret put NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Same value in Workers Builds "Build variables" |

Two important details:

- **`NEXT_PUBLIC_*` is inlined at build time.** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  is currently unused by code (no client-side Stripe SDK call site), but its build
  variable and runtime secret are retained for future use. When re-wired, Next.js
  replaces `process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in the client bundle
  during `opennextjs-cloudflare build`, so it must be present **as a build
  variable** (Cloudflare dashboard → Workers Builds → "Build variables and
  secrets") **and** deployed as a runtime secret for any server code that
  reads it. Locally, `next dev` and `wrangler dev` both read it from `.env*`
  / `.dev.vars`.
- **Never put secrets in `wrangler.jsonc` `vars`.** That field is for
  non-sensitive config (feature flags, public URLs) and is committed to git.
  Secrets go through `wrangler secret put` or the dashboard, which encrypts
  them at rest and keeps them out of the repo.

Keep key pairs matched: live secret + live publishable together, test pair
together. Mixing a live secret with a test publishable (or vice versa) will
fail.

## App Router gotchas

- **Body parsing is built-in.** `request.json()` works natively in route
  handlers — no `bodyParser` config or middleware needed (unlike Pages Router).
- **POST handlers are dynamic by default.** No need for
  `export const dynamic = 'force-dynamic'` on the checkout route.
- **Return `NextResponse.json()` or `Response.json()`** — both work.
- **Always wrap `stripe.checkout.sessions.create` in try/catch** and return a
  non-200 status on failure so the client can surface an error.