# Emily's Flowers — Agent Documentation

Reference docs for AI agents (and humans) working on this repository. These go
deeper than `AGENTS.md` on **version-specific gotchas and rationale** — the kind
of thing that will trip up an agent whose training data predates the stack
versions in use here.

## Relationship to `AGENTS.md`

[`AGENTS.md`](../AGENTS.md) is the **source of truth** for commands,
architecture, data/state, Stripe wiring, and styling/animation conventions. It
is intentionally short and authoritative. Edit it when you change anything it
documents.

These `docs/` files are **expansion packs**. They explain *why* the conventions
exist and flag the breaking changes an agent with older training data would get
wrong. If a doc here ever conflicts with `AGENTS.md`, `AGENTS.md` wins — fix the
doc.

## Stack versions (as of July 2026)

| Package | Version | Notes |
|---|---|---|
| Next.js | `16.2.11` | App Router, Turbopack default, async request APIs |
| React / react-dom | `19.2.4` | `use()`, Actions, `ref` as prop, `<Context>` shorthand |
| Tailwind CSS | `^4` (resolves to 4.3.x) | CSS-first config, no `tailwind.config.js` |
| GSAP | `^3.15.0` | Import via `@/lib/gsap`, not directly |
| `@gsap/react` | `^2.1.2` | `useGSAP` hook with automatic cleanup |
| `stripe` (server) | `^22.3.2` | Used in the checkout route handler |
| `@stripe/stripe-js` (client) | `^9.12.0` | `loadStripe` promise in `src/lib/stripe.ts` |

**These are newer than most training cutoffs.** Read the relevant doc before
writing code that touches any of these areas.

## Index

| Doc | When to read |
|---|---|
| [nextjs-and-react.md](./nextjs-and-react.md) | Before touching routes, layouts, data fetching, metadata, route handlers, or React hooks/components. Covers Next.js 16 + React 19 breaking changes. |
| [tailwind-and-styling.md](./tailwind-and-styling.md) | Before editing styles, theme tokens, `globals.css`, or adding visual components. Covers Tailwind v4 CSS-first config and the museum-plaque card language. |
| [animations.md](./animations.md) | Before writing any GSAP animation, scroll effect, or motion component. Covers the `@/lib/gsap` import rule, `useGSAP` cleanup, `gsap.matchMedia()`, and the PetalBurst singleton. |
| [stripe-checkout.md](./stripe-checkout.md) | Before touching `src/app/api/checkout/route.ts`, `src/lib/stripe.ts`, or Stripe env wiring. Covers the redirect pattern (`session.url`, not the removed `redirectToCheckout`) and Vercel env scoping. |

## Quick orientation

- **Package manager:** `bun` (lockfile is `bun.lock`; do not reintroduce
  `package-lock.json`).
- **Scripts:** only `dev`, `build`, `start`. No `lint`/`typecheck`/`test` script.
  Ad-hoc typecheck: `bunx tsc --noEmit`.
- **Path alias:** `@/*` → `./src/*`.
- **TypeScript:** `strict`, `noEmit`, `moduleResolution: bundler`.
- **Products** are hardcoded in `src/lib/products.ts` — no DB/CMS.
- **Prices** are integer cents everywhere (`2499` = $24.99).
- **Cart** is React Context + `useReducer` in `src/lib/cart-context.tsx`,
  persisted to `localStorage` key `emilys-flowers-cart`.
- **Stripe** creates real Checkout Sessions when `STRIPE_SECRET_KEY` is set;
  falls back to a simulated success URL when the key is absent. Live keys are
  scoped to the Vercel Production environment, test keys to Preview.