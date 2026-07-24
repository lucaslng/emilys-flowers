# Emily's Flowers

Handcrafted ribbon flower storefront. Browse individual ribbon flowers and bouquets, add them to a cart, and check out via Stripe.

Built with Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind v4, and GSAP animations.

## Getting started

Package manager is [bun](https://bun.sh). Install dependencies and start the dev server:

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
bun run dev       # dev server on :3000
bun run build     # production build
bun start         # serve the production build
bunx tsc --noEmit # ad-hoc typecheck (no script defined)
```

There is no `lint`, `typecheck`, or `test` script.

## Routes

- `/` — home
- `/flowers` — individual ribbon flowers
- `/bouquets` — bouquet collection
- `/cart` — shopping cart
- `/checkout` — checkout
- `POST /api/checkout` — Stripe Checkout session

## Stripe

`src/app/api/checkout/route.ts` creates a real Stripe Checkout Session when `STRIPE_SECRET_KEY` is set, and falls back to a simulated success URL when the key is absent (so `bun run dev` works without keys). Required env vars:

- `STRIPE_SECRET_KEY` (server) — live key for production, test key for preview/dev
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client) — matching live/test pair
- `NEXT_PUBLIC_BASE_URL` (success/cancel URLs) — production domain in Production; previews fall back to `NEXT_PUBLIC_VERCEL_URL`, local dev to `http://localhost:3000`

On Vercel, scope live keys to the Production environment and test keys to Preview so the production branch uses live and PR previews use sandbox.

`.env*` is gitignored.

## Project structure

- `src/app/` — App Router pages, layouts, API routes
- `src/components/` — UI, layout, cart, and shop components
- `src/lib/` — products data, cart context, GSAP setup, Stripe client, PetalBurst singleton
- `src/types/` — shared TypeScript types

Products are hardcoded in `src/lib/products.ts` (no database or CMS). Prices are integer cents (Stripe convention).