# Deployment — Cloudflare Workers

> **Read this before touching `wrangler.jsonc`, `open-next.config.ts`,
> `deploy.yml`/`test.yml`, or anything related to Flagship flags, secrets, or
> deploys.** This app is **not** a Vercel project.

## Cloudflare Workers via OpenNext

This app deploys to **Cloudflare Workers** via
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) (OpenNext). It is
**not** a Vercel project — `vercel.json` was removed and no Vercel env vars
(`VERCEL_ENV`, `VERCEL_URL`, `NEXT_PUBLIC_VERCEL_URL`) are referenced anywhere.
Do not reintroduce them.

### Two-Worker model (production + preview)

Cloudflare Workers has no built-in per-project Preview/Production env-var toggle
like Vercel — a single Worker's preview versions share its secret namespace with
production. To get env isolation (live Stripe keys on `main`, test keys
elsewhere), `wrangler.jsonc` defines **two Wrangler `[env.*]` environments**,
each of which is a **separate Worker** with its own name, secrets, vars, and
bindings:

- `env.production` → Worker `emilys-flowers-production` (live Stripe keys)
- `env.preview` → Worker `emilys-flowers-preview` (test Stripe keys)

**Non-inheritable keys** (`assets`, `services`, `images`, `observability`) are
repeated in each `[env.*]` stanza — Wrangler environments do not inherit them
from the top level. Critically, the `WORKER_SELF_REFERENCE` `service` field in
each env points to **that env's Worker name** (`emilys-flowers-production` /
`emilys-flowers-preview`), not the top-level `emilys-flowers`. Get this wrong
and OpenNext's revalidation binding breaks. The top-level config (including the
`WORKER_SELF_REFERENCE` → `emilys-flowers` binding) is kept for
`bun run preview` / local dev.

## Under-construction gate (Flagship)

The site can be put "under construction" so nothing is browsable or purchasable
while the storefront is being prepared. This is driven by a Cloudflare
**Flagship** feature flag: the `under-construction` boolean flag in the
`emilysflowers` Flagship app. When the flag is **on**, the production build
renders the construction screen on every page; when **off**, the store renders
normally. Local dev, preview builds, and E2E are never affected by this flag:
`evaluateUnderConstruction()` returns `false` whenever the
`UNDER_CONSTRUCTION_ENABLED` marker is absent (only the production build sets
it — see below), independent of whether Flagship credentials are present.

The check happens **at build time, exactly once per build**, exactly like
`enable-flowers-page`: `next.config.ts` (an async config function) calls
`evaluateUnderConstruction()` from `src/lib/under-construction.ts` in the main
build process and stores the result in `process.env.UNDER_CONSTRUCTION`, which
every static-gen worker inherits. The app reads it synchronously via
`isUnderConstruction()` (`process.env.UNDER_CONSTRUCTION === "true"` — fails
open to **not** under construction, the opposite direction of the flowers
flag). The evaluate call uses Node's `https` module (not the global `fetch`) so
Next.js's Data Cache never serves a stale flag value from a previous build; the
flag is re-evaluated fresh on every build, and flipping it in the dashboard
does **not** change already-deployed pages until the next CI build. No Flagship
SDK dependency. **Only the production build evaluates the flag**: `deploy.yml`
sets `UNDER_CONSTRUCTION_ENABLED: "true"` in the production `Build (OpenNext)`
step env, and `evaluateUnderConstruction()` returns `false` when that marker is
absent — so preview builds always render the store, never the construction
screen. (The Flagship credentials are still passed to both builds because
`enable-flowers-page` is evaluated in both.)

**The flag values only reach users because the prerendered pages are actually
served**: `open-next.config.ts` uses `staticAssetsIncrementalCache` and
`deploy.yml` runs `populateCache local` after the build, so the worker serves
the build-time prerendered HTML (flags baked in) instead of re-rendering at
runtime. If you ever remove the static-assets cache, the flags will silently
fail open in production again — the build-time `process.env` values do not
exist on the Worker at runtime.

When the flag is on, `src/app/layout.tsx` renders the standalone
`UnderConstruction` component (`src/components/under-construction.tsx`) instead
of the app tree (no Navbar/Footer/cart/providers). `src/app/robots.ts` returns
`disallow: '/'` while construction is on (blocks all crawling so the
construction page isn't indexed, while still advertising the sitemap);
otherwise it returns the normal rules (`allow: '/'`, `disallow: ['/cart',
'/checkout', '/api/']`).

There is **no runtime API gate**: the `POST /api/checkout` route no longer
returns `503` while construction is on (the old `wrangler.jsonc`
`env.production.vars.UNDER_CONSTRUCTION` runtime var was removed with the
env-var mechanism). The construction screen hides the cart/checkout UI, but a
direct API call can still create a Stripe session while the flag is on.

**To open the store later:** flip the `under-construction` flag **off** in the
Flagship dashboard, then redeploy. Locally, a developer can force the
construction screen with `UNDER_CONSTRUCTION=true` in `.env.local` — the
`next.config.ts` guard skips evaluation when the var is already set.

## Flowers catalogue flag (Flagship)

The entire flowers catalogue can be hidden behind a Cloudflare **Flagship**
feature flag: `enable-flowers-page` in the `emilysflowers` Flagship app. When
the flag is **off**, `/flowers` and every flower product page render 404, the
nav/footer/hero/404 "browse flowers" links disappear, featured products on the
home page exclude flowers, and the sitemap drops the `/flowers` and flower
product URLs. When **on** (or when Flagship credentials are absent — local dev,
E2E), everything renders as normal. Unlike `under-construction`, this flag is
**not** gated to production builds: a developer with Flagship credentials in
`.env.local` will see the flag applied locally.

The check happens **at build time, exactly once per build**: `next.config.ts`
(an async config function) calls `evaluateFlowersEnabled()` from
`src/lib/flowers-flag.ts` in the main build process — before static-generation
workers spawn — and stores the result in `process.env.FLOWERS_ENABLED`, which
every worker thread inherits. The app then reads it synchronously via
`isFlowersEnabled()` (`process.env.FLOWERS_ENABLED !== "false"`, fails open to
enabled). This avoids both Next.js's Data Cache (a cached fetch would serve a
stale flag value from a previous build — the Data Cache persists across builds
with a 1-year revalidate) and per-page-render fetches. The evaluate call uses
Node's `https` module (not the global `fetch`) so the Data Cache never
intercepts it; the flag is re-evaluated fresh on every build. The result is
baked into the static pages — like the `under-construction` flag, flipping the
flag in the dashboard does **not** change already-deployed pages until the next
CI build. No Flagship SDK dependency is used. Import `isFlowersEnabled` only
from server components (layout, pages, Footer, not-found, FeaturedBouquets,
sitemap) — never from client components; client components receive the value as
a prop (e.g. `Navbar showFlowers`, `Hero showFlowers`, `NotFoundClient`).
Like `under-construction`, this only works because the prerendered pages are
served via `staticAssetsIncrementalCache` + `populateCache local` (see the
under-construction section).

Credentials are passed to **both** `Build (OpenNext)` steps in `deploy.yml`
(production and preview evaluate the same flag): `FLAGSHIP_APP_ID`,
`CLOUDFLARE_API_TOKEN` (the same single API token used for the wrangler deploys —
it must carry Flagship read/evaluate permission plus the Workers deploy
permissions), and `CLOUDFLARE_ACCOUNT_ID`.

## CI/CD — GitHub Actions

Two GitHub Actions workflows handle CI and deploys (not Cloudflare's built-in
Workers Builds):

- **`.github/workflows/test.yml`** — PR-only CI feedback. Runs unit tests
  always; E2E only when a `changes` job detects app/e2e-affecting files
  (`src/`, `e2e/`, `public/`, `playwright.config.ts`, `next.config.ts`,
  `tsconfig.json`, `package.json`, `bun.lock`, `.github/workflows/`).
  Docs/config-only PRs skip E2E. Does **not** trigger on push (avoids
  duplicating tests that `deploy.yml` already runs).
- **`.github/workflows/deploy.yml`** — push-triggered. Runs unit tests always;
  E2E via the same `changes` path-filter. Deploys based on branch:
  - `main` push → `deploy-production` job →
    `opennextjs-cloudflare deploy --env production -- --keep-vars` (promotes to
    the production Worker's production URL)
  - any other branch push → `deploy-preview` job →
    `opennextjs-cloudflare upload --env preview -- --keep-vars --preview-alias <sanitized-branch>`
    (creates a per-branch preview version with a stable URL like
    `<branch>-emilys-flowers-preview.<subdomain>.workers.dev`, without
    overwriting other branches' previews)
  - **gating differs by deploy target:** `deploy-preview` gates on
    `needs: [unit]` only (previews are disposable, deploy fast);
    `deploy-production` gates on `needs: [unit, e2e]` but uses `!cancelled()` +
    explicit `needs.*.result` checks so it proceeds when E2E was path-filtered
    out (skipped) while still blocking on a failed or non-skipped E2E. A red
    unit suite blocks both.
  - `concurrency` cancels superseded preview runs but never cancels a
    production deploy mid-flight
  - `deploy-preview` also posts a **sticky PR comment** with the preview URL: a
    `github-script` step looks up the PR for the head SHA via
    `listPullRequestsAssociatedWithCommit` (the workflow is `push`-triggered, so
    `github.event.pull_request` is unavailable), then
    `marocchino/sticky-pull-request-comment@v3` creates or updates a single
    comment keyed by the `cloudflare-preview-url` header. Re-pushes update the
    same comment instead of stacking duplicates. The job carries a job-scoped
    `pull-requests: write` permission for this; branches with no open PR skip
    the comment step.

`--keep-vars` is **required** on every deploy: without it, `wrangler deploy`/
`wrangler versions upload` deletes dashboard-set runtime secrets
(`STRIPE_SECRET_KEY`) that aren't declared in `wrangler.jsonc`. The `--`
separator is required by the OpenNext CLI's yargs setup to forward `--keep-vars`
(and `--preview-alias`) to `wrangler` as positional args.

The preview job uses `upload` (which calls `wrangler versions upload`) rather
than `deploy` so each branch gets its own preview version instead of
overwriting the preview Worker's production deployment. All preview versions
share the `emilys-flowers-preview` Worker's secret namespace (test Stripe
keys), which is exactly what's wanted — every preview branch should use test
keys.

## Required GitHub Secrets

| Secret | Used by | Notes |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | both deploys + both builds | single API token: Workers deploys (scripts, assets, custom-domain routes) + Flagship read/evaluate for the build-time flag checks |
| `CLOUDFLARE_ACCOUNT_ID` | both deploys | |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE` | production build | `pk_live_...`, inlined by Next.js at build time |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST` | preview build | `pk_test_...`, inlined by Next.js at build time |
| `STRIPE_SECRET_KEY_LIVE` | production build | `sk_live_...`, used at build time to fetch the Stripe product catalog |
| `STRIPE_SECRET_KEY_TEST` | preview build | `sk_test_...`, used at build time to fetch the Stripe product catalog |
| `FLAGSHIP_APP_ID` | both builds | Flagship app ID (dashboard: Compute → Flagship → `emilysflowers`), used at build time to evaluate `enable-flowers-page` and `under-construction` |

`STRIPE_SECRET_KEY` is needed in **two** places:

1. **At build time** (to fetch the product catalog during static generation) —
   provided as the GitHub Secrets `STRIPE_SECRET_KEY_LIVE` /
   `STRIPE_SECRET_KEY_TEST`, passed into the `Build (OpenNext)` step env in
   `deploy.yml`.
2. **At runtime** (for the checkout route) — a runtime secret set once per
   Worker via `wrangler secret put STRIPE_SECRET_KEY --env production` /
   `--env preview` (or the dashboard's Variables & Secrets for each Worker).
   This is a *different* value from the build-time secret and is never a GitHub
   Secret.

## One-time setup

```bash
# 1. Create both Workers (run from a worktree):
bunx opennextjs-cloudflare build
bunx wrangler deploy --env production
bunx wrangler deploy --env preview

# 2. Set runtime secrets per Worker (one-time):
echo "sk_live_..." | bunx wrangler secret put STRIPE_SECRET_KEY --env production
echo "sk_test_..." | bunx wrangler secret put STRIPE_SECRET_KEY --env preview

# 3. Add the six GitHub Secrets above to the repo, then push.
```

## Other config

- **`wrangler.jsonc`** is the Workers config: `main: .open-next/worker.js`,
  `nodejs_compat` flag, `IMAGES` binding (Cloudflare Images for `next/image`),
  and `WORKER_SELF_REFERENCE` service binding (required by OpenNext for ISR
  revalidation, even though this app has no ISR today — keep it).
- **`open-next.config.ts`** is the OpenNext adapter config. It enables
  `staticAssetsIncrementalCache` (read-only Workers Static Assets cache): the
  worker serves the build-time prerendered pages from the assets instead of
  re-rendering every page at runtime. This is what makes the build-time
  Flagship flag values actually reach users — without it, the default "dummy"
  cache re-renders every page on the Worker, where the build-time `process.env`
  flag values don't exist, so every flag check fails open (flowers visible, no
  under-construction). The cache is populated by `populateCache local` in
  `deploy.yml` after `build` and before `deploy`/`upload` (copies
  `.open-next/cache` into the assets at `cdn-cgi/_next_cache/`). R2 incremental
  cache is the alternative if you add cached data fetching with revalidation.
- **`next.config.ts`** ends with an unconditional
  `import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev())`
  — this is the official pattern; it injects `wrangler.jsonc` bindings into
  `next dev` so `getCloudflareContext()` works locally. It self-guards outside
  dev.
- **Generated dirs** `.open-next/` (build output) and `.wrangler/` (local
  state) are gitignored. `cloudflare-env.d.ts` (from `bun run cf-typegen`) is
  also gitignored — regenerate it locally when you start referencing
  `CloudflareEnv` in code, then commit it once code depends on its types.
- **Local Workers secrets** go in `.dev.vars` (gitignored). A
  `.dev.vars.example` template is tracked. Runtime secrets on production are
  set via `wrangler secret put` or the Cloudflare dashboard — never in
  `wrangler.jsonc` `vars` (that's for non-sensitive config only).