<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:worktree-skill -->
This repo uses a **bare-repo + sibling-worktree** layout — not `.slim/worktrees/`. When starting worktree operations, load the project skill from `.agents/skills/worktrees/SKILL.md`; the global worktrees skill describes a different convention.
<!-- END:worktree-skill -->

# Emily's Flowers

Handcrafted-ribbon-flower storefront. Next.js 16 App Router + React 19, TypeScript (strict), Tailwind v4, GSAP animations, Stripe. Single package, no monorepo.

## Commands

```bash
bun run dev       # dev server on :3000 (Next.js, with OpenNext bindings injected)
bun run build     # production build (Next.js)
bun start         # serve the production build (Node.js runtime — NOT Workers)
bun test          # unit tests (bun's built-in runner)
bun run test:e2e  # Playwright E2E (builds + serves on :3000 first)
bun run preview   # build + serve in the local Workers runtime (Miniflare via wrangler)
bun run deploy   # build + deploy to Cloudflare Workers
bun run upload    # build + upload Worker without activating (wrangler upload)
bun run cf-typegen # regenerate cloudflare-env.d.ts from wrangler.jsonc bindings
bunx tsc --noEmit # ad-hoc typecheck (no script defined)
```

There is **no `lint` or `typecheck` script** — do not assume they work. `bun test` and `bun run test:e2e` are defined; see the Testing section below for the full stack.

Package manager is **bun**. `bun.lock` is the tracked lockfile; `package-lock.json` has been removed — do not reintroduce it or switch to npm.

## Deployment — Cloudflare Workers

This app deploys to **Cloudflare Workers** via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) (OpenNext). It is **not** a Vercel project — `vercel.json` was removed and no Vercel env vars (`VERCEL_ENV`, `VERCEL_URL`, `NEXT_PUBLIC_VERCEL_URL`) are referenced anywhere. Do not reintroduce them.

### Two-Worker model (production + preview)

Cloudflare Workers has no built-in per-project Preview/Production env-var toggle like Vercel — a single Worker's preview versions share its secret namespace with production. To get env isolation (live Stripe keys on `main`, test keys elsewhere), `wrangler.jsonc` defines **two Wrangler `[env.*]` environments**, each of which is a **separate Worker** with its own name, secrets, vars, and bindings:

- `env.production` → Worker `emilys-flowers-production` (live Stripe keys)
- `env.preview` → Worker `emilys-flowers-preview` (test Stripe keys)

### Under-construction gate (production only)

The site can be put "under construction" so nothing is browsable or purchasable in
production while the storefront is being prepared. This is driven by a single
`UNDER_CONSTRUCTION` env flag that is `"true"` **only** for production and unset
everywhere else (dev, preview, E2E).

Because most pages are statically prerendered at build time (served as Cloudflare
assets, never running worker code per request), the flag must be set in **two
places** for full coverage:

1. **`deploy.yml` `deploy-production` → `Build (OpenNext)` step env** sets
   `UNDER_CONSTRUCTION: "true"`. Static pages baked by that build render the
   construction screen; the preview build (no flag) bakes the normal site.
2. **`wrangler.jsonc` → `env.production.vars.UNDER_CONSTRUCTION = "true"`**.
   Request-time code on the production Worker sees it via `process.env`, so the
   `POST /api/checkout` route returns `503` even on a direct API call. Preview
   inherits the top-level config (no flag) → checkout works there.

The gate itself is `isUnderConstruction()` in `src/lib/under-construction.ts`
(`process.env.UNDER_CONSTRUCTION === "true"` — plain env, no Cloudflare
context needed, unit-tested). When it's on, `src/app/layout.tsx` renders the
standalone `UnderConstruction` component (`src/components/under-construction.tsx`)
instead of the app tree (no Navbar/Footer/cart/providers).

`src/app/robots.ts` handles robots.txt. While construction is on it returns
`disallow: '/'` (blocks all crawling so the construction page isn't indexed,
while still advertising the sitemap); otherwise it returns the normal rules
(`allow: '/'`, `disallow: ['/cart', '/checkout', '/api/']`). Note: this branch
also introduces `robots.ts` itself — the committed base had no robots file.

**To open the store later:** remove the `UNDER_CONSTRUCTION: "true"` line from
the `deploy.yml` production build step and flip/remove
`env.production.vars.UNDER_CONSTRUCTION`, then redeploy. (The API gate would
still be armed by the wrangler var alone, so flip both together.)

**Non-inheritable keys** (`assets`, `services`, `images`, `observability`) are repeated in each `[env.*]` stanza — Wrangler environments do not inherit them from the top level. Critically, the `WORKER_SELF_REFERENCE` `service` field in each env points to **that env's Worker name** (`emilys-flowers-production` / `emilys-flowers-preview`), not the top-level `emilys-flowers`. Get this wrong and OpenNext's revalidation binding breaks. The top-level config (including the `WORKER_SELF_REFERENCE` → `emilys-flowers` binding) is kept for `bun run preview` / local dev.

### CI/CD — GitHub Actions

Two GitHub Actions workflows handle CI and deploys (not Cloudflare's built-in Workers Builds):

- **`.github/workflows/test.yml`** — PR-only CI feedback. Runs unit tests always; E2E only when a `changes` job detects app/e2e-affecting files (`src/`, `e2e/`, `public/`, `playwright.config.ts`, `next.config.ts`, `tsconfig.json`, `package.json`, `bun.lock`, `.github/workflows/`). Docs/config-only PRs skip E2E. Does **not** trigger on push (avoids duplicating tests that `deploy.yml` already runs).
- **`.github/workflows/deploy.yml`** — push-triggered. Runs unit tests always; E2E via the same `changes` path-filter. Deploys based on branch:
  - `main` push → `deploy-production` job → `opennextjs-cloudflare deploy --env production -- --keep-vars` (promotes to the production Worker's production URL)
  - any other branch push → `deploy-preview` job → `opennextjs-cloudflare upload --env preview -- --keep-vars --preview-alias <sanitized-branch>` (creates a per-branch preview version with a stable URL like `<branch>-emilys-flowers-preview.<subdomain>.workers.dev`, without overwriting other branches' previews)
  - **gating differs by deploy target:** `deploy-preview` gates on `needs: [unit]` only (previews are disposable, deploy fast); `deploy-production` gates on `needs: [unit, e2e]` but uses `!cancelled()` + explicit `needs.*.result` checks so it proceeds when E2E was path-filtered out (skipped) while still blocking on a failed or non-skipped E2E. A red unit suite blocks both.
  - `concurrency` cancels superseded preview runs but never cancels a production deploy mid-flight
  - `deploy-preview` also posts a **sticky PR comment** with the preview URL: a `github-script` step looks up the PR for the head SHA via `listPullRequestsAssociatedWithCommit` (the workflow is `push`-triggered, so `github.event.pull_request` is unavailable), then `marocchino/sticky-pull-request-comment@v3` creates or updates a single comment keyed by the `cloudflare-preview-url` header. Re-pushes update the same comment instead of stacking duplicates. The job carries a job-scoped `pull-requests: write` permission for this; branches with no open PR skip the comment step.

`--keep-vars` is **required** on every deploy: without it, `wrangler deploy`/`wrangler versions upload` deletes dashboard-set runtime secrets (`STRIPE_SECRET_KEY`) that aren't declared in `wrangler.jsonc`. The `--` separator is required by the OpenNext CLI's yargs setup to forward `--keep-vars` (and `--preview-alias`) to `wrangler` as positional args.

The preview job uses `upload` (which calls `wrangler versions upload`) rather than `deploy` so each branch gets its own preview version instead of overwriting the preview Worker's production deployment. All preview versions share the `emilys-flowers-preview` Worker's secret namespace (test Stripe keys), which is exactly what's wanted — every preview branch should use test keys.

### Required GitHub Secrets

| Secret | Used by | Notes |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | both deploys | scoped to Workers deploys for this account |
| `CLOUDFLARE_ACCOUNT_ID` | both deploys | |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE` | production build | `pk_live_...`, inlined by Next.js at build time |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST` | preview build | `pk_test_...`, inlined by Next.js at build time |

`STRIPE_SECRET_KEY` is **never** a GitHub Secret — it's a runtime secret set once per Worker via `wrangler secret put STRIPE_SECRET_KEY --env production` / `--env preview` (or the dashboard's Variables & Secrets for each Worker).

### One-time setup

```bash
# 1. Create both Workers (run from a worktree):
bunx opennextjs-cloudflare build
bunx wrangler deploy --env production
bunx wrangler deploy --env preview

# 2. Set runtime secrets per Worker (one-time):
echo "sk_live_..." | bunx wrangler secret put STRIPE_SECRET_KEY --env production
echo "sk_test_..." | bunx wrangler secret put STRIPE_SECRET_KEY --env preview

# 3. Add the four GitHub Secrets above to the repo, then push.
```

### Other config

- **`wrangler.jsonc`** is the Workers config: `main: .open-next/worker.js`, `nodejs_compat` flag, `IMAGES` binding (Cloudflare Images for `next/image`), and `WORKER_SELF_REFERENCE` service binding (required by OpenNext for ISR revalidation, even though this app has no ISR today — keep it).
- **`open-next.config.ts`** is the OpenNext adapter config. The default `defineCloudflareConfig({})` is sufficient for this app (hardcoded products, no ISR/SSG data fetching, no DB). R2 incremental cache is commented out — enable it only if you add cached data fetching.
- **`next.config.ts`** ends with an unconditional `import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev())` — this is the official pattern; it injects `wrangler.jsonc` bindings into `next dev` so `getCloudflareContext()` works locally. It self-guards outside dev.
- **Generated dirs** `.open-next/` (build output) and `.wrangler/` (local state) are gitignored. `cloudflare-env.d.ts` (from `bun run cf-typegen`) is also gitignored — regenerate it locally when you start referencing `CloudflareEnv` in code, then commit it once code depends on its types.
- **Local Workers secrets** go in `.dev.vars` (gitignored). A `.dev.vars.example` template is tracked. Runtime secrets on production are set via `wrangler secret put` or the Cloudflare dashboard — never in `wrangler.jsonc` `vars` (that's for non-sensitive config only).

## Architecture

- App Router under `src/app/`. Routes: `/`, `/flowers`, `/bouquets`, `/cart`, `/checkout`, and `POST /api/checkout`.
- `src/app/template.tsx` wraps every page in a `page-enter` animation and **remounts on segment navigation** (`useEffect` re-runs per route) — use it for per-route effects, not for state that must persist across navigations.
- `src/app/layout.tsx` is the root: loads fonts, wraps the tree in `CartProvider` + `PetalBurstProvider`, renders `Navbar`/`Footer`. When the `UNDER_CONSTRUCTION` flag is on (see Deployment), it instead renders only the standalone `UnderConstruction` component — no providers, no nav, no footer.
- Path alias `@/*` → `./src/*`. TypeScript `strict`, `noEmit`, `moduleResolution: bundler`.

## Data & state

- **Products are hardcoded** in `src/lib/products.ts` (no DB/CMS). Helpers: `getProductById`, `getFeaturedProducts`, `getProductsByCategory`. Images are local per-category SVG placeholders (`/placeholders/flower.svg`, `/placeholders/bouquet.svg`) rendered through the `ProductImage` component (`src/components/shop/ProductImage.tsx`), which falls back to the category SVG on image-load error. `next.config.ts` `images.remotePatterns` is empty (no remote hosts); real product photos will be added later.
- **Prices are integer cents** (Stripe convention): `2499` = $24.99. All order/cart math stays in cents; the pure helpers live in \`src/lib/order.ts\` (see below). Display formatting goes through `formatPrice` (`src/lib/format.ts`), which returns the decimal string (no `$`); callers add the symbol. The free-shipping threshold ($50 = 5000¢, else flat $5.99 = 599¢) lives in \`computeShipping\` (\`src/lib/order.ts\`) — \`CartSummary\`, \`checkout/page.tsx\`, and \`checkout/success/page.tsx\` all call it, so don't re-inline the ternary.
- **Cart** is React Context + `useReducer` in `src/lib/cart-context.tsx`, persisted to `localStorage` key `emilys-flowers-cart` (hydrated client-side on mount). `useCart()` throws if used outside `CartProvider` (which lives in the root layout, so this is normally fine). The \`cartReducer\` and the \`toLineItems\` seam are exported from that module for isolated unit testing. The order math (\`computeLineItemTotal\`, \`computeLineItemCount\`, \`computeShipping\`) and \`validateLineItems\` live in \`src/lib/order.ts\` and operate on the flat \`LineItem\` shape; the provider's \`getTotal\`/\`getItemCount\` flatten \`CartItem[]\` to \`LineItem[]\` via \`toLineItems\` and delegate to them.

## Stripe

`src/app/api/checkout/route.ts` creates a real Stripe Checkout Session when `STRIPE_SECRET_KEY` is set; when the key is absent (e.g. local dev without `.env.local`) it falls back to a simulated success URL so `bun run dev` still works. The route derives `origin` from `request.url` (no `NEXT_PUBLIC_BASE_URL` / `NEXT_PUBLIC_VERCEL_URL` fallback chain — those were removed with the Vercel migration).

Required env vars:

- `STRIPE_SECRET_KEY` (server) — live key for production, test key for preview/dev
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client) — currently unused by code (no client-side Stripe SDK call site); reserved for future Embedded Checkout / Elements use. Must match the secret key's mode when wired in.

On Cloudflare Workers, `STRIPE_SECRET_KEY` is a runtime secret set **per Worker** via `wrangler secret put STRIPE_SECRET_KEY --env production` (live) or `--env preview` (test) — never in `wrangler.jsonc` `vars` (that's for non-sensitive config only), and never as a GitHub Secret. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is currently unused by code (no client-side Stripe SDK call site), but the matching publishable key is still provided to the build as a GitHub Secret (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE` for `main`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST` for other branches) — see the Deployment section's GitHub Secrets table. Locally, both come from `.env.local` (read by `next dev`) or `.dev.vars` (read by `wrangler dev` / `bun run preview`).

## Testing

Two layers: **bun test** for unit tests and **Playwright** for E2E. Both are wired and must stay green.

- **Unit tests** live in `src/lib/__tests__/*.test.ts` and are pure-logic (no DOM, no TSX rendering) — they test \`products.ts\` data/helpers, the exported \`cartReducer\`, the \`toLineItems\` seam, and the extracted pure helpers (\`formatPrice\` in \`src/lib/format.ts\`; \`computeLineItemTotal\` / \`computeLineItemCount\` / \`computeShipping\` and \`validateLineItems\` in \`src/lib/order.ts\`). Use `import { test, expect, describe } from "bun:test"`. The `@/*` path alias resolves automatically (bun reads `tsconfig.json` paths). No happy-dom / testing-library — keep unit tests dependency-free; if a component needs DOM rendering, that belongs in E2E, not here.
- **E2E tests** live in `e2e/*.spec.ts` and use `@playwright/test`. `playwright.config.ts` runs `bun run build && bun run start` on `:3000` (production build, per Next.js guidance) with a chromium project and `baseURL http://localhost:3000`. Prefer web-first assertions (`expect(locator).toBeVisible()` / `toContainText()`) — they auto-wait and absorb the `template.tsx` page-enter animation. To put items in the cart, drive the real UI (navigate to `/bouquets`, click "Add to Cart") rather than injecting `localStorage`, except for narrow edge cases where `page.addInitScript` is clearer.
- **Checkout E2E runs in simulated mode** — `playwright.config.ts` prefixes the webServer command with `STRIPE_SECRET_KEY=` (empty) so `/api/checkout` always uses its simulated success path (redirects to `/checkout/success?success=true&order=...&items=...` and `CheckoutSuccessContent` clears the cart), even when a developer has a real key in `.env`. Next.js does not override an existing env var (even empty) with `.env` values, so this forces `!secretKey` → simulated path. E2E must never hit the real Stripe API. The API route is also tested directly (empty items → 400 with `error: "No items provided"`, valid items → 200 with `url`). Input validation lives in \`validateLineItems\` (\`src/lib/order.ts\`) and is unit-tested there; the route imports it. The empty-items 400 error string is asserted by E2E — keep it stable.
- **`bunfig.toml`** excludes `e2e/**` from `bun test` discovery so the two runners don't collide. `bun test` runs only unit tests; `bun run test:e2e` runs only Playwright.
- **Generated dirs** `test-results/` and `playwright-report/` are gitignored. Browser binaries live outside the repo (installed via `bunx playwright install chromium`).
- When adding source that should be unit-testable as pure logic, export the function (as `cartReducer`, `formatPrice`, `computeCartTotal`, `computeCartItemCount`, `computeShipping`, and `validateLineItems` are exported) rather than reaching for a DOM test harness. Price formatting goes through `formatPrice` (`src/lib/format.ts`); cart/order math and the free-shipping threshold ($50 = 5000¢) go through the \`compute*\` helpers in \`src/lib/order.ts\` — don't re-inline \`(x / 100).toFixed(2)\` or \`subtotal >= 5000 ? 0 : 599\` in components. \`formatPrice\` (\`src/lib/format.ts\`) is the only price formatter.

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
- **Don't reference external repos' issues/PRs/commits** in this repo's issues, PRs, or commit messages. No "fixes vercel/next.js#1234", no "based on facebook/react#5678", no citing upstream issue/PR numbers you can't verify belong to this codebase. Only reference this repo's own issues/PRs/commits.

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
- **Keep this file accurate.** If you change anything documented here — commands, architecture, data/state, Stripe wiring, styling/animation conventions, git conventions, worktree workflow — update the corresponding section in this same edit. Treat `AGENTS.md` as living documentation, not a snapshot.