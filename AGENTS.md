<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Emily's Flowers

Handcrafted-ribbon-flower storefront. Next.js 16 App Router + React 19, TypeScript (strict), Tailwind v4, GSAP animations, Stripe (stubbed). Single package, no monorepo.

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

## Stripe (currently stubbed)

`src/app/api/checkout/route.ts` **simulates** a successful checkout — the real `stripe.checkout.sessions.create` call is commented out and it returns a fake success URL. `src/lib/stripe.ts` loads the client via `@stripe/stripe-js`.

To enable real payments, uncomment the Stripe block in the route and set:
- `STRIPE_SECRET_KEY` (server)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client, used by `src/lib/stripe.ts`)
- `NEXT_PUBLIC_BASE_URL` (success/cancel URLs; defaults to `http://localhost:3000`)

`.env*` is gitignored.

## Styling & animation conventions

- **Tailwind v4, CSS-first config**: there is no `tailwind.config.js`. Theme tokens are declared with `@theme inline` in `src/app/globals.css`. Custom color tokens: `background`, `foreground`, `surface`, `blush`, `lavender`, `rose`, `border`, `muted`. Fonts map to `--font-sans` (Inter) / `--font-serif` (Playfair Display).
- **GSAP**: import `gsap`, `ScrollTrigger`, and `useGSAP` from `@/lib/gsap` — not directly from `gsap`/`@gsap/react`. That module registers the plugins once and clears a `body.style` write that otherwise triggers a Next.js hydration warning. It is client-only.
- **PetalBurst** is a global singleton: `PetalBurstProvider` is mounted once in the root layout; call `firePetalBurst(from, to)` from any client component (viewport coords) — no prop drilling.
- **Reduced motion**: `globals.css` collapses animations to ~instant and hides decorative petals under `prefers-reduced-motion: reduce`. New animations/motion components must respect this guard.
- **Product cards use a "museum-plaque" style** (`.plaque-card` in globals.css): sharp corners, 1px hairline border, no shadow, hover draws a rose underline under the name. Match this language for new product-facing cards rather than introducing generic rounded/shadowed cards.

## Notes

- `CLAUDE.md` contains only `@AGENTS.md` — this file is the source of truth; edit here, not there.
- `next-env.d.ts`, `*.tsbuildinfo`, and `.next/` are gitignored (generated). Don't edit `next-env.d.ts`.
- **Keep this file accurate.** If you change anything documented here — commands, architecture, data/state, Stripe wiring, styling/animation conventions — update the corresponding section in this same edit. Treat `AGENTS.md` as living documentation, not a snapshot.