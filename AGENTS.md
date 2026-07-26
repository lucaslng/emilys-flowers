<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Emily's Flowers

Handcrafted-ribbon-flower storefront. Next.js 16 App Router + React 19, TypeScript (strict), Tailwind v4, GSAP animations, Stripe. Single package, no monorepo.

## Commands

Only three scripts exist — there is **no `lint`, `typecheck`, or `test` script**. Do not assume they work.

```bash
bun run dev       # dev server on :3000
bun run build     # production build
bun start         # serve the production build
bunx tsc --noEmit # ad-hoc typecheck (no script defined)
```

Package manager is **bun**. `bun.lock` is the tracked lockfile; `package-lock.json` has been removed — do not reintroduce it or switch to npm.

## Architecture

- App Router under `src/app/`. Routes: `/`, `/flowers`, `/bouquets`, `/cart`, `/checkout`, and `POST /api/checkout`.
- `src/app/template.tsx` wraps every page in a `page-enter` animation and **remounts on segment navigation** (`useEffect` re-runs per route) — use it for per-route effects, not for state that must persist across navigations.
- `src/app/layout.tsx` is the root: loads fonts, wraps the tree in `CartProvider` + `PetalBurstProvider`, renders `Navbar`/`Footer`.
- Path alias `@/*` → `./src/*`. TypeScript `strict`, `noEmit`, `moduleResolution: bundler`.

## Data & state

- **Products are hardcoded** in `src/lib/products.ts` (no DB/CMS). Helpers: `getProductById`, `getFeaturedProducts`, `getProductsByCategory`. Images are `picsum.photos` placeholders, whitelisted in `next.config.ts` `images.remotePatterns`.
- **Prices are integer cents** (Stripe convention): `2499` = $24.99. All cart math in `src/lib/cart-context.tsx` stays in cents.
- **Cart** is React Context + `useReducer` in `src/lib/cart-context.tsx`, persisted to `localStorage` key `emilys-flowers-cart` (hydrated client-side on mount). `useCart()` throws if used outside `CartProvider` (which lives in the root layout, so this is normally fine).

## Stripe

`src/app/api/checkout/route.ts` creates a real Stripe Checkout Session when `STRIPE_SECRET_KEY` is set; when the key is absent (e.g. local dev without `.env.local`) it falls back to a simulated success URL so `bun run dev` still works. `src/lib/stripe.ts` loads the client via `@stripe/stripe-js`.

Required env vars:
- `STRIPE_SECRET_KEY` (server) — live key for production, test key for preview/dev
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client, used by `src/lib/stripe.ts`) — must match the same mode as the secret key
- `NEXT_PUBLIC_BASE_URL` (success/cancel URLs) — set to the production domain in the Production environment; previews fall back to the auto-injected `NEXT_PUBLIC_VERCEL_URL`, local dev defaults to `http://localhost:3000`

On Vercel, scope live keys to the **Production** environment and test keys to **Preview** so the production branch uses live and PR previews use sandbox. `.env*` is gitignored.

## Security headers & CSP

`next.config.ts` bakes a Content-Security-Policy and security headers into every response at build time (so the policy is fixed per deployment — `VERCEL_ENV` at build determines which variant ships). See `docs/security-headers.md` for the full rationale.

- **`script-src` carries `'unsafe-inline'`** because Next.js/React emit inline scripts (RSC payload, streaming retry, route timing) core to hydration. **SRI does not replace `'unsafe-inline'`** — SRI only adds `integrity` to *external* scripts; it does nothing for inline execution. They're complementary.
- **`'unsafe-eval'`** is gated on `NODE_ENV === 'development'` (not `VERCEL_ENV`) — Vercel preview builds are production builds and don't need it.
- **`experimental.sri` is disabled.** Turbopack's runtime chunk uses a stable (non-content-hashed) filename, so Vercel's CDN serves stale chunks across deployments and SRI integrity checks fail — known bug [vercel/next.js#91633](https://github.com/vercel/next.js/issues/91633), open since Mar 2026. The CSP with `'unsafe-inline'` already handles script authorization; SRI was additive. See `docs/security-headers.md`.
- **vercel.live** is scoped into script/connect/frame-src only on non-production (#16).
- **`worker-src`** allows `blob:` + `m.stripe.network` for Stripe Radar fraud detection (#14).
- **COEP is report-only** — enforcing breaks Stripe checkout iframes (#15). **CORP `same-origin`** is enforced (governs how others embed us, not how we load Stripe).
- Pages are fully static; a nonce-based CSP would force dynamic rendering on every page (no static gen/ISR/PPR/CDN caching), so we keep `'unsafe-inline'` + SRI instead.

## Styling & animation conventions

- **Tailwind v4, CSS-first config**: there is no `tailwind.config.js`. Theme tokens are declared with `@theme inline` in `src/app/globals.css`. Custom color tokens: `background`, `foreground`, `surface`, `blush`, `lavender`, `rose`, `border`, `muted`. Fonts map to `--font-sans` (Inter) / `--font-serif` (Playfair Display).
- **GSAP**: import `gsap`, `ScrollTrigger`, and `useGSAP` from `@/lib/gsap` — not directly from `gsap`/`@gsap/react`. That module registers the plugins once and clears a `body.style` write that otherwise triggers a Next.js hydration warning. It is client-only.
- **PetalBurst** is a global singleton: `PetalBurstProvider` is mounted once in the root layout; call `firePetalBurst(from, to)` from any client component (viewport coords) — no prop drilling.
- **Reduced motion**: `globals.css` collapses animations to ~instant and hides decorative petals under `prefers-reduced-motion: reduce`. New animations/motion components must respect this guard.
- **Product cards use a "museum-plaque" style** (`.plaque-card` in globals.css): sharp corners, 1px hairline border, no shadow, hover draws a rose underline under the name. Match this language for new product-facing cards rather than introducing generic rounded/shadowed cards.

## Git conventions

- **Branch prefixes (required from now on):** name every new branch with one of these prefixes:
  - `feature/` — new functionality or enhancements (e.g. `feature/gift-wrap-option`)
  - `bugfix/` — defect fixes (e.g. `bugfix/cart-cents-rounding`)
  - `docs/` — documentation-only changes (e.g. `docs/branch-prefix-policy`)
- Do not branch off `main` with a bare name or an ad-hoc prefix. If an existing branch predates this policy, leave it as-is; apply the prefixes to new work going forward.

## Worktree workflow

This repo uses a **bare-repo + sibling-worktree** layout — not `.slim/worktrees/`. The repo root is a bare repository (`.bare/` + a `.git` file pointing at it); each worktree is a sibling directory at the root, organized by branch prefix:

```text
emilys-flowers/
├── .bare/            # shared bare store
├── main/             # worktree on `main`
├── feature/<slug>/   # worktree on `feature/<slug>`
├── bugfix/<slug>/    # worktree on `bugfix/<slug>`
└── docs/<slug>/      # worktree on `docs/<slug>`
```

To start a lane from the repo root:

```bash
git worktree add -b <prefix>/<slug> <prefix>/<slug> main
```

Do all lane work inside the worktree directory, not `main/`. There is no `.slim/` and no metadata manifest — do not create them. See `.agents/skills/worktrees/SKILL.md` for the full protocol (pre-flight, integration, cleanup, user-confirmation guards).

## Notes

- `CLAUDE.md` contains only `@AGENTS.md` — this file is the source of truth; edit here, not there.
- `next-env.d.ts`, `*.tsbuildinfo`, and `.next/` are gitignored (generated). Don't edit `next-env.d.ts`.
- **Keep this file accurate.** If you change anything documented here — commands, architecture, data/state, Stripe wiring, security headers/CSP, styling/animation conventions, git conventions, worktree workflow — update the corresponding section in this same edit. Treat `AGENTS.md` as living documentation, not a snapshot.