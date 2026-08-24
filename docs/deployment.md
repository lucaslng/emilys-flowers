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

**Non-inheritable keys** (`assets`, `services`, `images`, `observability`,
`ratelimits`) are repeated in each `[env.*]` stanza — Wrangler environments do
not inherit them from the top level. Critically, the `WORKER_SELF_REFERENCE`
`service` field in each env points to **that env's Worker name**
(`emilys-flowers-production` / `emilys-flowers-preview`), not the top-level
`emilys-flowers`. Get this wrong and OpenNext's revalidation binding breaks.
The top-level config (including the `WORKER_SELF_REFERENCE` →
`emilys-flowers` binding) is kept for `bun run preview` / local dev.

The `ratelimits` array defines the `RATE_LIMITER` binding (10 requests /
60 s, used by `src/lib/rate-limit.ts` to protect Stripe API quota and the
admin OIDC sign-in endpoints). It is
declared in **all three** config blocks — top level plus both `[env.*]`
stanzas — with a **distinct `namespace_id` per block** (`1001` top-level,
`1002` production, `1003` preview; string-wrapped ints, account-unique) so
each environment keeps an independent counter. Note that `bun run cf-typegen`
regenerates a `RATE_LIMITER: RateLimit` entry in `cloudflare-env.d.ts`, but
the generated file currently breaks `tsc --noEmit` elsewhere (its
`NodeJS.ProcessEnv` augmentation makes env vars non-optional, breaking
`delete process.env.X` in unit tests, and its runtime-types section conflicts
with lib.dom), so `rate-limit.ts` types the binding structurally instead and
the generated file stays ungenerated (it's gitignored).

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
`evaluateUnderConstruction()` from `src/lib/flagship-flag.ts` in the main
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

**The flag values reach users because they are compiled into the JS bundle**:
after evaluation, `next.config.ts` passes both results through the `env` config
(`UNDER_CONSTRUCTION` / `FLOWERS_ENABLED`), so Next.js replaces every
`process.env.<FLAG>` read with the build-time literal at compile time. Every
render — prerendered or on-demand — therefore sees the same build-time decision,
and flipping a flag in the dashboard does **not** change already-deployed pages
until the next CI build. (The `staticAssetsIncrementalCache` + `populateCache
local` setup in `open-next.config.ts`/`deploy.yml` is still what lets the worker
serve the prerendered HTML/RSC assets, but flag correctness no longer depends on
it.)

Consequently **every storefront render shows the gate while the flag is on**:
prerendered pages, unmatched URLs (the root `src/app/not-found.tsx` is
prerendered, so `/foo` shows the construction screen too), and on-demand renders
such as an unknown `/products/<slug>` that calls `notFound()`. Those on-demand
renders used to fail open — the runtime Worker has no such env var, so they
served the normal storefront 404 in the shell with full site navigation, letting
visitors click straight into the store and bypassing the gate.

When the flag is on, `src/app/(store)/layout.tsx` renders the standalone
`UnderConstruction` component (`src/components/under-construction.tsx`) instead
of the storefront shell (no Navbar/Footer/cart/providers). The `/admin/*`
routes are exempt: `src/app/admin/layout.tsx` renders the same storefront shell
with no gate, so the owner can still review orders and send shipping
notifications while the storefront is down. `src/app/robots.ts` returns
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
`src/lib/flagship-flag.ts` (the shared Flagship flag module, alongside
`under-construction`) in the main build process — before static-generation
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
Like `under-construction`, the value is inlined into the bundle via the
`env` config, so on-demand renders (e.g. flower product pages that 404 on
demand) see the same build-time decision.

Credentials are passed to **both** `Build (OpenNext)` steps in `deploy.yml`
(production and preview evaluate the same flag): `FLAGSHIP_APP_ID`,
`CLOUDFLARE_API_TOKEN` (the same single API token used for the wrangler deploys —
it must carry Flagship read/evaluate permission plus the Workers deploy
permissions), and `CLOUDFLARE_ACCOUNT_ID`.

## CI/CD — GitHub Actions

Two GitHub Actions workflows handle CI and deploys (not Cloudflare's built-in
Workers Builds):

- **`.github/workflows/test.yml`** — the single source of truth for the test
  jobs (`changes`/`unit`/`e2e` shards + `e2e-result`/`merge-reports`). Called
  as a **reusable workflow** by
  `deploy.yml` on every push — PR checks come from that same run, so there is
  no standalone `pull_request` trigger (removed to stop the unit suite from
  running twice on every PR push).
  Unit tests always run; E2E only when the `changes` job detects
  app/e2e-affecting files (`src/`, `e2e/`, `public/`, `playwright.config.ts`,
  `next.config.ts`, `tsconfig.json`, `package.json`, `bun.lock`,
  `.github/workflows/`). Docs/config-only PRs skip E2E. When called from
  `deploy.yml`, E2E additionally runs only on `main` pushes — the sole consumer
  of the e2e result is `deploy-production` — so non-main pushes run unit only
   instead of a discarded ~10 min suite. Exposes
   `unit-result` / `e2e-result` outputs for `deploy.yml` gating — unit via its
   `job.status` report step, e2e via an `e2e-result` aggregator job that reads
   the shard matrix's `needs.e2e.result` (the `jobs.<job>.result` expression in
   output values is buggy and resolves empty).
- **`.github/workflows/deploy.yml`** — push-triggered. Calls `test.yml` with
  `secrets: inherit` (the `tests` job), then deploys based on branch:
  - `main` push → `deploy-production` job →
    `opennextjs-cloudflare deploy --env production -- --keep-vars` (promotes to
    the production Worker's production URL)
  - any other branch push → `deploy-preview` job →
    `opennextjs-cloudflare upload --env preview -- --keep-vars --preview-alias <sanitized-branch>`
    (creates a per-branch preview version with a stable URL like
    `<branch>-emilys-flowers-preview.<subdomain>.workers.dev`, without
    overwriting other branches' previews)
  - **gating differs by deploy target:** `deploy-preview` gates on the
    `unit-result` output only (previews are disposable, deploy fast; e2e never
    blocks them); `deploy-production` requires the whole tests run to succeed —
    unit passed AND e2e passed or was skipped (path-filtered out). A red unit
    suite blocks both; a failed e2e blocks production only. Because both deploy
    jobs depend on the single `tests` job, preview waits for the tests run to
    finish before deploying — on non-main pushes that run is unit-only (e2e is
    skipped there), so previews no longer wait on a discarded e2e suite.
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

### GitHub Environments (build-time secret scoping)

Build-time secrets are scoped with **GitHub Environments** — distinct from the
Wrangler `[env.*]` environments above (same names, different concepts):

- **`production` environment** — live Stripe keys (`STRIPE_SECRET_KEY`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`), used by the `deploy-production` job.
  Its **deployment-branch rule** (main only) is enforced by GitHub as
  defense-in-depth on top of the workflow's `if:` gate — a job targeting
  `production` from any other branch fails the run.
- **`preview` environment** — test Stripe keys (same secret names), used by the
  `deploy-preview` job **and** the `e2e` job in `test.yml`. The e2e job sets
  `environment: { name: preview, deployment: false }` — it's a CI job, not a
  deployment, so it stays out of the preview deployment history. No protection
  rules: every branch may deploy a preview.
- **Repo-level secrets** — `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
  `FLAGSHIP_APP_ID` are shared by both jobs and both builds, so they stay at
  repo level rather than being duplicated per environment.

Environment secrets are only visible to jobs that set `environment:`; they are
**not** delivered by `secrets: inherit` to jobs that don't reference an
environment. That's why the `e2e` job declares `environment: preview` itself
instead of receiving the key from the caller.

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

Secrets are split between **repo-level** (shared by both deploy paths) and
**GitHub Environment** (scoped to `production` / `preview`; see the GitHub
Environments section above). The old `_LIVE`/`_TEST`-suffixed repo secrets
(`STRIPE_SECRET_KEY_LIVE`, `STRIPE_SECRET_KEY_TEST`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST`)
are **gone** — delete them once the environment secrets below are in place.

### Repo-level

| Secret | Used by | Notes |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | both deploys + both builds | single API token: Workers deploys (scripts, assets, custom-domain routes) + Flagship read/evaluate for the build-time flag checks |
| `CLOUDFLARE_ACCOUNT_ID` | both deploys | |
| `FLAGSHIP_APP_ID` | both builds | Flagship app ID (dashboard: Compute → Flagship → `emilysflowers`), used at build time to evaluate `enable-flowers-page` and `under-construction` |

### Environment `production`

| Secret | Used by | Notes |
|---|---|---|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | production build | `pk_live_...`, inlined by Next.js at build time |
| `STRIPE_SECRET_KEY` | production build | `sk_live_...`, used at build time to fetch the Stripe product catalog |

### Environment `preview`

| Secret | Used by | Notes |
|---|---|---|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | preview build | `pk_test_...`, inlined by Next.js at build time |
| `STRIPE_SECRET_KEY` | preview build + e2e | `sk_test_...`, used at build time to fetch the Stripe product catalog |

`STRIPE_SECRET_KEY` is needed in **two** places:

1. **At build time** (to fetch the product catalog during static generation) —
   provided as the GitHub Environment secrets above, read by the
   `Build (OpenNext)` step env in `deploy.yml` (and the e2e job in `test.yml`).
2. **At runtime** (for the checkout route) — a runtime secret set once per
   Worker via `wrangler secret put STRIPE_SECRET_KEY --env production` /
   `--env preview` (or the dashboard's Variables & Secrets for each Worker).
   This is a *different* value from the build-time secret and is never a GitHub
   Secret.

### Runtime-only secrets (order emails)

These runtime secrets are read **only at runtime** on the Worker (never at
build time), so they are set per Worker via `wrangler secret put` — they are
not GitHub Secrets and never appear in `deploy.yml`:

| Secret | Used by | Notes |
|---|---|---|
| `RESEND_API_KEY` | `src/lib/email.ts` | Send-only Resend API key (`re_...`). Missing → email functions throw. |
| `STRIPE_WEBHOOK_SECRET` | `POST /api/webhooks/stripe` | `whsec_...` from the Stripe dashboard (prod) or `stripe listen` (dev). Missing → dev-mode skips signature verification. |
| `OIDC_ISSUER` | `src/lib/admin-auth.ts` | Provider issuer URL (e.g. `https://accounts.example.com`); discovery doc fetched at `{issuer}/.well-known/openid-configuration`. Missing → admin page shows a config error. |
| `OIDC_CLIENT_ID` | `src/lib/admin-auth.ts` | OIDC client ID. Missing → admin page shows a config error. |
| `OIDC_CLIENT_SECRET` | `src/lib/admin-auth.ts` | OIDC client secret. Missing → admin page shows a config error. |
| `ADMIN_SESSION_SECRET` | `src/lib/admin-auth.ts` | HS256 signing key for the session JWT (≥ 32 chars; generate with `openssl rand -base64 32`). Missing → admin page shows a config error. |
| `ADMIN_OIDC_GROUPS` | `src/lib/admin-auth.ts` | Comma-separated group names; the signed-in user must belong to at least one (provider must expose a `groups` claim in the ID token or userinfo). Missing → admin page shows a config error. |
| `BASE_URL` | `src/lib/base-url.ts` (OIDC callback via `src/lib/admin-auth.ts`; Stripe success/cancel URLs via `src/app/api/checkout/route.ts`) | The site's root URL (e.g. `https://emilysflowers.ca`). Required in production — both the OIDC callback and the checkout success/cancel URLs are derived from it, never from the Host header; optional in dev (falls back to the request origin). The derived callback URL must match the one registered in the provider exactly. |

See [order-emails.md](./order-emails.md) for the flow these power, and its
[`ADMIN_SESSION_SECRET` rotation runbook](./order-emails.md#admin_session_secret-rotation-runbook)
— rotating that secret is the only way to revoke issued admin sessions.

### Runtime-only secrets (ChitChats shipping)

These runtime secrets are read **only at runtime** on the Worker (never at
build time), so they are set per Worker via `wrangler secret put` — they are
not GitHub Secrets and never appear in `deploy.yml`:

| Secret | Used by | Notes |
|---|---|---|
| `CHITCHATS_CLIENT_ID` | `src/lib/chitchats.ts` | ChitChats client id, used in the URL path `/api/v1/clients/{id}/shipments`. Missing → checkout falls back to the pre-ChitChats behavior (no shipping options). |
| `CHITCHATS_ACCESS_TOKEN` | `src/lib/chitchats.ts` | ChitChats access token — sent as a **bare token** (no `Bearer` prefix). Missing → same fallback as above. |
| `CHITCHATS_BASE_URL` | `src/lib/chitchats.ts` | Optional. Defaults to `https://chitchats.com` (production); set to `https://staging.chitchats.com` for the sandbox. |

See [shipping.md](./shipping.md) for the flow these power.

## One-time setup

```bash
# 1. Create both Workers (run from a worktree):
bunx opennextjs-cloudflare build
bunx wrangler deploy --env production
bunx wrangler deploy --env preview

# 2. Set runtime secrets per Worker (one-time):
echo "sk_live_..." | bunx wrangler secret put STRIPE_SECRET_KEY --env production
echo "sk_test_..." | bunx wrangler secret put STRIPE_SECRET_KEY --env preview
echo "re_..." | bunx wrangler secret put RESEND_API_KEY --env production
echo "re_..." | bunx wrangler secret put RESEND_API_KEY --env preview
echo "whsec_..." | bunx wrangler secret put STRIPE_WEBHOOK_SECRET --env production
echo "whsec_..." | bunx wrangler secret put STRIPE_WEBHOOK_SECRET --env preview
echo "https://accounts.example.com" | bunx wrangler secret put OIDC_ISSUER --env production
echo "https://accounts.example.com" | bunx wrangler secret put OIDC_ISSUER --env preview
echo "your-client-id" | bunx wrangler secret put OIDC_CLIENT_ID --env production
echo "your-client-id" | bunx wrangler secret put OIDC_CLIENT_ID --env preview
echo "your-client-secret" | bunx wrangler secret put OIDC_CLIENT_SECRET --env production
echo "your-client-secret" | bunx wrangler secret put OIDC_CLIENT_SECRET --env preview
# ADMIN_SESSION_SECRET must be >= 32 chars (generate with `openssl rand -base64 32`)
echo "replace-with-openssl-rand-base64-32-output" | bunx wrangler secret put ADMIN_SESSION_SECRET --env production
echo "replace-with-openssl-rand-base64-32-output" | bunx wrangler secret put ADMIN_SESSION_SECRET --env preview
echo "emilys-flowers-admins" | bunx wrangler secret put ADMIN_OIDC_GROUPS --env production
echo "emilys-flowers-admins" | bunx wrangler secret put ADMIN_OIDC_GROUPS --env preview
echo "https://emilysflowers.ca" | bunx wrangler secret put BASE_URL --env production
# Preview: use the per-branch root URL; the callback URL is derived by appending /api/admin/callback
echo "https://<branch>-emilys-flowers-preview.<subdomain>.workers.dev" | bunx wrangler secret put BASE_URL --env preview
# ChitChats shipping (bare access token, no Bearer prefix; staging base for sandbox)
echo "your-client-id" | bunx wrangler secret put CHITCHATS_CLIENT_ID --env production
echo "your-client-id" | bunx wrangler secret put CHITCHATS_CLIENT_ID --env preview
echo "your-access-token" | bunx wrangler secret put CHITCHATS_ACCESS_TOKEN --env production
echo "your-access-token" | bunx wrangler secret put CHITCHATS_ACCESS_TOKEN --env preview
echo "https://staging.chitchats.com" | bunx wrangler secret put CHITCHATS_BASE_URL --env production
echo "https://staging.chitchats.com" | bunx wrangler secret put CHITCHATS_BASE_URL --env preview

# 3. Create the GitHub Environments and move the build-time secrets (see
#    "GitHub Environments" above): `production` (live keys, deployment-branch
#    rule = main only) and `preview` (test keys, no rules). Then delete the old
#    `_LIVE`/`_TEST`-suffixed repo secrets.

# 4. Register the webhook endpoint in the Stripe dashboard:
#    https://dashboard.stripe.com/webhooks → add endpoint
#    URL: https://emilysflowers.ca/api/webhooks/stripe
#    Events: checkout.session.completed
#    Copy the whsec_... signing secret into STRIPE_WEBHOOK_SECRET above.

# 5. Push — the workflows pick up the environment secrets automatically.
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