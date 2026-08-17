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
bun run dev       # dev server on :3000 (Next.js, with OpenNext bindings injected)
bun run build     # production build (Next.js)
bun start         # serve the production build (Node.js runtime — NOT Workers)
bun test          # unit tests (bun's built-in runner)
bun run test:e2e  # Playwright E2E (builds + serves on :3000 first)
bun run preview   # build + serve in the local Workers runtime (Miniflare via wrangler)
bun run deploy    # build + deploy to Cloudflare Workers
bun run upload    # build + upload Worker without activating (wrangler upload)
bun run cf-typegen # regenerate cloudflare-env.d.ts from wrangler.jsonc bindings
bunx tsc --noEmit # ad-hoc typecheck (no script defined)
```

There is no `lint` or `typecheck` script. `bun test` runs the unit tests.

## Deployment — Cloudflare Workers

This app deploys to **Cloudflare Workers** via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) (OpenNext), not Vercel.

- `wrangler.jsonc` — Workers config (`main`, `nodejs_compat`, `IMAGES` binding for `next/image`, `WORKER_SELF_REFERENCE` service binding).
- `open-next.config.ts` — OpenNext adapter config (enables `staticAssetsIncrementalCache` so the worker serves build-time prerendered pages).
- `bun run preview` — build + serve locally in the Workers runtime (Miniflare) to verify before deploying.
- `bun run deploy` — build + deploy to Cloudflare Workers.

Secrets (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) are set via `wrangler secret put` or the Cloudflare dashboard — never in `wrangler.jsonc` `vars`. Locally, use `.dev.vars` (gitignored; see `.dev.vars.example`).

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

`.env*` is gitignored.

## Project structure

- `src/app/` — App Router pages, layouts, API routes
- `src/components/` — UI, layout, cart, and shop components
- `src/lib/` — Stripe catalog, cart context, GSAP setup, Stripe client, PetalBurst singleton
- `src/types/` — shared TypeScript types

Products come from the Stripe catalog, fetched at build time by `src/lib/stripe-catalog.ts` (no database or CMS). Prices are integer cents (Stripe convention).