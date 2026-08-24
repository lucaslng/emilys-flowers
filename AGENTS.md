<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:worktree-skill -->
This repo uses a **bare-repo + sibling-worktree** layout — not `.slim/worktrees/`. When starting worktree operations, load the project skill from `.agents/skills/worktrees/SKILL.md`; the global worktrees skill describes a different convention.
<!-- END:worktree-skill -->

# Emily's Flowers

Handcrafted-ribbon-flower storefront. Next.js 16 App Router + React 19, TypeScript (strict), Tailwind v4, GSAP animations, Stripe, Cloudflare Workers. Single package, no monorepo.

## Commands

```bash
bun run dev       # dev server on :3000 (Next.js, with OpenNext bindings injected)
bun run build     # production build (Next.js)
bun start         # serve the production build (Node.js runtime — NOT Workers)
bun test          # unit tests (bun's built-in runner)
bun run typecheck # TypeScript typecheck (tsc --noEmit)
bun run test:e2e  # Playwright E2E (builds + serves on :3000 first)
bun run preview   # build + serve in the local Workers runtime (Miniflare via wrangler)
bun run deploy    # build + deploy to Cloudflare Workers
bun run upload    # build + upload Worker without activating (wrangler upload)
bun run cf-typegen # regenerate cloudflare-env.d.ts from wrangler.jsonc bindings
```

There is **no `lint` script** — do not assume it works. `bun test`, `bun run typecheck`, and `bun run test:e2e` are defined. Package manager is **bun** (`bun.lock` tracked; `package-lock.json` removed — do not reintroduce it or switch to npm).

## Documentation

`docs/README.md` is the index of topic docs. Read the relevant one before touching its area:

- [docs/deployment.md](docs/deployment.md) — Cloudflare Workers deployment, Flagship flags, CI/CD, secrets
- [docs/testing.md](docs/testing.md) — unit + E2E + accessibility testing
- [docs/data-and-state.md](docs/data-and-state.md) — Stripe catalog, cart, order math
- [docs/nextjs-and-react.md](docs/nextjs-and-react.md) — Next.js 16 + React 19 conventions
- [docs/tailwind-and-styling.md](docs/tailwind-and-styling.md) — Tailwind v4 + styling
- [docs/animations.md](docs/animations.md) — GSAP, PetalBurst, reduced motion
- [docs/stripe-checkout.md](docs/stripe-checkout.md) — checkout route + Stripe env wiring
- [docs/shipping.md](docs/shipping.md) — ChitChats shipping (create-shipment-for-rates flow, env vars, metadata keys)
- [docs/order-emails.md](docs/order-emails.md) — Resend order confirmation + shipped emails, Stripe webhook, admin order review
- [docs/opengraph-image.md](docs/opengraph-image.md) — editing the social share image (source pipeline, safe zones, brand tokens)

## Architecture

- App Router under `src/app/`. Routes: `/`, `/flowers`, `/bouquets`, `/products/[slug]`, `/cart`, `/checkout`, `/admin/orders` (OIDC-gated order review), and API routes `POST /api/checkout` (rate-limited 10/min/IP via the Workers ratelimit binding), `GET /api/checkout/session` (sanitized success-receipt retrieval, same rate limit — limiter keys are surface-prefixed so the two routes never share a bucket), `POST /api/webhooks/stripe` (order-confirmation email), `GET /api/admin/login` (OIDC redirect) and `GET /api/admin/callback` (both rate-limited 10/min/IP via the Workers ratelimit binding, surface-prefixed keys `admin-login:`/`admin-callback:`), `GET /api/admin/logout`, `POST /api/admin/orders/[sessionId]/ship` (shipped email).
- `src/app/layout.tsx` is the root: loads fonts, renders `<html>`/`<body>`. The storefront shell (`CartProvider` + `PetalBurstProvider`, `Navbar`/`Footer`) is `src/components/layout/StoreShell.tsx`, mounted by `src/app/(store)/layout.tsx` (storefront routes — hosts the under-construction gate) and `src/app/admin/layout.tsx` (admin routes — exempt from the gate).
- `src/app/template.tsx` wraps every page in a `page-enter` animation and **remounts on segment navigation** (`useEffect` re-runs per route) — use it for per-route effects, not state that must persist.
- Path alias `@/*` → `./src/*`. TypeScript `strict`, `noEmit`, `moduleResolution: bundler`.

## Data & state

Products come from the **Stripe catalog**, fetched at build time by the server-only `src/lib/stripe-catalog.ts` (no DB/CMS) and memoized with React `cache`; images are scanned from `public/products/<slug>/`. At checkout, the client posts only `{productId, quantity}` pairs and the route resolves names/prices/price-ids against a module-memoized runtime catalog index (`src/lib/catalog-index.ts`, Workers-safe — no `node:fs`); unknown product ids are rejected with 400. Prices are **integer cents** (`2499` = $24.99); display via `formatPrice` (`src/lib/format.ts`), order math via `computeShipping`/`computeLineItemTotal`/`computeLineItemCount`/`validateCheckoutItems`/`mergeCheckoutItems` in `src/lib/order.ts` (free-shipping threshold $50 = 5000¢, else 599¢; at most 20 lines per checkout request, per-line quantity cap 99, duplicate productIds merged server-side before pricing). Cart is React Context + `useReducer` in `src/lib/cart-context.tsx`, persisted to `localStorage` key `emilys-flowers-cart` with `sanitizeStoredCart` on hydration. See [docs/data-and-state.md](docs/data-and-state.md).

## Deployment

Deploys to **Cloudflare Workers** via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) (OpenNext) — **not** Vercel (`vercel.json` removed; no `VERCEL_*` vars). Two Wrangler `[env.*]` environments, each a separate Worker: `env.production` → `emilys-flowers-production` (live Stripe keys), `env.preview` → `emilys-flowers-preview` (test keys). Build-time secrets are scoped by **GitHub Environments** (`production`/`preview` — live/test Stripe keys; shared Cloudflare/Flagship secrets stay repo-level; the `production` environment's deployment-branch rule restricts deploys to `main`). Build-time Flagship flags (`under-construction` + `enable-flowers-page`) are evaluated once per build in `next.config.ts` and inlined into the JS bundle via the `env` config, so prerendered pages **and** on-demand renders (e.g. unknown product slugs hitting `not-found`) all honor the same build-time value. `--keep-vars` is **required** on every deploy. See [docs/deployment.md](docs/deployment.md).

## Stripe

`src/app/api/checkout/route.ts` creates a real Stripe Checkout Session when `STRIPE_SECRET_KEY` is set; when absent it returns `503 { error: 'Stripe is not configured.' }` — there is no simulated checkout path. Success URLs carry only `order` + `session_id` (no product data, no display-only params); the success page renders its receipt solely from `GET /api/checkout/session`. E2E intercepts both checkout APIs with Playwright `page.route()` so tests never hit the real Stripe API. When ChitChats is configured (`CHITCHATS_CLIENT_ID` + `CHITCHATS_ACCESS_TOKEN`), the route creates a ChitChats shipment to obtain rates and charges the cheapest one as the Stripe shipping option (fail closed — no flat-rate fallback). `STRIPE_SECRET_KEY` is needed **at build time** (GitHub Environment secret `STRIPE_SECRET_KEY` in `production`/`preview` — live/test) **and** at runtime (`wrangler secret put` per Worker). See [docs/stripe-checkout.md](docs/stripe-checkout.md), [docs/shipping.md](docs/shipping.md), and [docs/deployment.md](docs/deployment.md).

## Order emails (Resend)

On `checkout.session.completed`, `POST /api/webhooks/stripe` sends the customer an order-confirmation email via Resend (`src/lib/email.ts`, from `Emily's Flowers <hello@emilysflowers.ca>`). The owner then reviews orders at `/admin/orders` (gated by OIDC — authorization code + PKCE; access restricted to OIDC groups via `ADMIN_OIDC_GROUPS`) and confirms shipping by entering an estimated shipping time, which triggers the shipped email and stamps `shipped_at`/`shipping_estimate` on the Stripe session metadata. Runtime-only secrets: `RESEND_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `ADMIN_SESSION_SECRET`, `ADMIN_OIDC_GROUPS` (`wrangler secret put` per Worker). See [docs/order-emails.md](docs/order-emails.md).

## Testing

`bun test` runs pure-logic unit tests (`src/lib/__tests__/*.test.ts`, no DOM); Playwright E2E (`e2e/*.spec.ts`) builds + serves the production build on `:3000`; axe-core scans every public route for WCAG 2.2 AA. See [docs/testing.md](docs/testing.md).

## Styling & animation

Tailwind v4, CSS-first: theme tokens via `@theme inline` in `src/app/globals.css` (no `tailwind.config.js`). Warm "gift-tag" card language (`.gift-card`) and deliberately non-standard/asymmetric layouts. Import GSAP only from `@/lib/gsap`; respect the `prefers-reduced-motion` guard. See [docs/tailwind-and-styling.md](docs/tailwind-and-styling.md) and [docs/animations.md](docs/animations.md).

## Git conventions

- Branch prefixes **required**: `feature/` (new functionality, e.g. `feature/gift-wrap-option`), `bugfix/` (defects, e.g. `bugfix/cart-cents-rounding`), `docs/` (docs-only, e.g. `docs/branch-prefix-policy`). No bare/ad-hoc branch names off `main`; leave pre-policy branches as-is.
- **Don't reference external repos' issues/PRs/commits** in this repo's issues, PRs, or commit messages — only this repo's own.

## Worktree workflow

Bare-repo + sibling-worktree layout — **not** `.slim/worktrees/`. The repo root is a bare repo (`.bare/` + a `.git` file); worktrees are sibling dirs by branch prefix (`main/`, `feature/<slug>/`, `bugfix/<slug>/`, `docs/<slug>/`). Start a lane with `git worktree add -b <prefix>/<slug> <prefix>/<slug> main`; do all lane work inside the worktree, not `main/`. See `.agents/skills/worktrees/SKILL.md` for the full protocol.

## Notes

- `CLAUDE.md` contains only `@AGENTS.md` — this file is the source of truth; edit here, not there.
- `next-env.d.ts`, `*.tsbuildinfo`, and `.next/` are gitignored (generated). Don't edit `next-env.d.ts`.
- **Keep this file accurate.** If you change anything documented here — commands, architecture, data/state, Stripe wiring, styling/animation conventions, git conventions, worktree workflow — update the corresponding section in this same edit. Treat `AGENTS.md` as living documentation, not a snapshot.