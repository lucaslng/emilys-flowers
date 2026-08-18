# Emily's Flowers — Agent Documentation

Reference docs for AI agents (and humans) working on this repository. These go
deeper than `AGENTS.md` on **version-specific gotchas and rationale** — the kind
of thing that will trip up an agent whose training data predates the stack
versions in use here.

## Relationship to `AGENTS.md`

[`AGENTS.md`](../AGENTS.md) is a **high-level overview** — commands, architecture
sketch, and pointers to these docs. It is intentionally short so it stays cheap
to inject into every agent's context. Edit it when you change anything it
documents.

These `docs/` files are the **depth**: the full deployment/testing/data details
plus the *why* behind the conventions and the breaking changes an agent with
older training data would get wrong. If a doc here ever conflicts with
`AGENTS.md`, `AGENTS.md` wins — fix the doc.

## Stack versions (as of July 2026)

| Package | Version | Notes |
|---|---|---|
| Next.js | `16.2.12` | App Router, Turbopack default, async request APIs |
| React / react-dom | `19.2.8` | `use()`, Actions, `ref` as prop, `<Context>` shorthand |
| Tailwind CSS | `^4` (resolves to 4.3.x) | CSS-first config, no `tailwind.config.js` |
| GSAP | `^3.15.0` | Import via `@/lib/gsap`, not directly |
| `@gsap/react` | `^2.1.2` | `useGSAP` hook with automatic cleanup |
| `stripe` (server) | `^22.3.2` | Used in the checkout route handler |

**These are newer than most training cutoffs.** Read the relevant doc before
writing code that touches any of these areas.

## Index

| Doc | When to read |
|---|---|
| [deployment.md](./deployment.md) | Before touching `wrangler.jsonc`, `open-next.config.ts`, `deploy.yml`/`test.yml`, Flagship flags, or secrets. Covers the two-worker model, build-time Flagship flags, CI/CD, GitHub Secrets, and the `--keep-vars` requirement. |
| [testing.md](./testing.md) | Before adding or modifying tests. Covers `bun test` unit tests, Playwright E2E (simulated checkout mode), axe-core WCAG 2.2 AA scans, and runner separation. |
| [data-and-state.md](./data-and-state.md) | Before touching product data, the cart, prices, or order math. Covers the Stripe catalog fetch, integer-cents prices, cart context, and `src/lib/order.ts` helpers. |
| [nextjs-and-react.md](./nextjs-and-react.md) | Before touching routes, layouts, data fetching, metadata, route handlers, or React hooks/components. Covers Next.js 16 + React 19 breaking changes. |
| [tailwind-and-styling.md](./tailwind-and-styling.md) | Before editing styles, theme tokens, `globals.css`, or adding visual components. Covers Tailwind v4 CSS-first config and the warm gift-tag card language. |
| [animations.md](./animations.md) | Before writing any GSAP animation, scroll effect, or motion component. Covers the `@/lib/gsap` import rule, `useGSAP` cleanup, `gsap.matchMedia()`, and the PetalBurst singleton. |
| [stripe-checkout.md](./stripe-checkout.md) | Before touching `src/app/api/checkout/route.ts` or Stripe env wiring. Covers the redirect pattern (`session.url`, not the removed `redirectToCheckout`) |
| [order-emails.md](./order-emails.md) | Before touching `src/lib/email.ts`, the Stripe webhook route, or `src/app/admin/orders/**`. Covers the Resend confirmation + shipped emails, the webhook, and the password-gated admin flow. |
| [opengraph-image.md](./opengraph-image.md) | Before editing the social share image (`public/opengraph-image.png`). Covers the `og-src/` + `scripts/og/` source pipeline, safe zones, brand tokens, and type rules. |

## Quick orientation

- **Package manager:** `bun` (lockfile is `bun.lock`; do not reintroduce
  `package-lock.json`).
- **Scripts:** `dev`, `build`, `start`, `test`, `test:e2e`, `preview`,
  `deploy`, `upload`, `cf-typegen`. No `lint`/`typecheck` script — ad-hoc
  typecheck: `bunx tsc --noEmit`.
- **Path alias:** `@/*` → `./src/*`.
- **TypeScript:** `strict`, `noEmit`, `moduleResolution: bundler`.
- **Products** come from the Stripe catalog, fetched at build time by
  `src/lib/stripe-catalog.ts` — no DB/CMS.
- **Prices** are integer cents everywhere (`2499` = $24.99).
- **Cart** is React Context + `useReducer` in `src/lib/cart-context.tsx`,
  persisted to `localStorage` key `emilys-flowers-cart`.
- **Stripe** creates real Checkout Sessions when `STRIPE_SECRET_KEY` is set
  (live or test mode); falls back to a simulated success URL when absent.