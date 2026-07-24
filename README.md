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
- `POST /api/checkout` — Stripe Checkout session (currently stubbed)

## Stripe

Checkout is currently **stubbed** — `src/app/api/checkout/route.ts` simulates a successful checkout. To enable real payments, uncomment the Stripe block in that route and set:

- `STRIPE_SECRET_KEY` (server)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client)
- `NEXT_PUBLIC_BASE_URL` (success/cancel URLs; defaults to `http://localhost:3000`)

`.env*` is gitignored.

## Project structure

- `src/app/` — App Router pages, layouts, API routes
- `src/components/` — UI, layout, cart, and shop components
- `src/lib/` — products data, cart context, GSAP setup, Stripe client, PetalBurst singleton
- `src/types/` — shared TypeScript types

Products are hardcoded in `src/lib/products.ts` (no database or CMS). Prices are integer cents (Stripe convention).