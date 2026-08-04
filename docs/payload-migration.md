# Payload CMS Migration Plan (handoff for implementing agents)

Status: **Plan — Phase 0 complete (verified 2026-08-03).** See "Phase 0 results" below for
the verdicts, the Payload version pin, and two plan corrections (queue requirement, and
on-demand-only ISR). A future agent can execute Phase 1 without needing the original
conversation.

## Purpose & how to use this doc

This is the plan for migrating the product catalog from a **build-time Stripe API fetch**
to **Payload CMS**, keeping deployment on Cloudflare Workers via OpenNext and adopting an
**on-demand revalidation (ISR)** rendering model. It is the single source of truth for the
migration. If you are an agent about to implement this:

1. Read `AGENTS.md` first (repo conventions, worktree protocol, "this is NOT the Next.js
   you know" warning — read `node_modules/next/dist/docs/` before writing code).
2. Follow the phased plan below; do **not** skip the Phase 0 verifications.
3. Work in a `feature/payload-cms` worktree (see `.agents/skills/worktrees/SKILL.md`),
   never directly on `main`.
4. Update this doc as the plan changes, and update `AGENTS.md` when the migration lands
   (it is living documentation).

## TL;DR of the decisions already made

| Decision | Choice | Rationale |
|---|---|---|
| Rendering model | **On-demand revalidation (classic route-segment ISR)** — `export const revalidate` + `revalidateTag(tag, profile)`; **not** Cache Components | CMS edits go live without redeploy; responses stay cached; OpenNext's R2/DO machinery is built for classic ISR; Cache Components have open OpenNext bugs |
| Next 16 stance | Stay on classic ISR (`revalidate` export + `generateStaticParams`), which remains documented in 16.2.12 | `cacheComponents: true` disables `dynamicParams`, breaks with OpenNext (#1130, #1225) |
| Hosting shape | **Single Worker** (official `with-cloudflare-d1` path): Payload + admin + storefront in one OpenNext Worker. Split hosting is the fallback if admin auth on Workers blocks progress | Official, documented route; requires **paid Workers plan** (bundle >3 MiB free limit) |
| Revalidation trigger | **Dedicated webhook route with shared-secret auth** (`src/app/api/revalidate/route.ts`) calling `revalidateTag('products', 'max')`, plus in-process `afterChange`/`afterDelete` Payload hooks | Webhook route is independent of the admin-request context (which has an open auth bug) and survives a future split-hosting move |
| Data layer | New `src/lib/payload-catalog.ts` exposing the **same 4-query API**, delete `src/lib/stripe-catalog.ts` | All consumers stay untouched — this seam is the whole strategy |
| Stripe | Stays as payment processor only (checkout route uses inline `price_data`, decoupled from catalog). Optional `@payloadcms/plugin-stripe` for two-way product sync (Phase 5) | Zero changes to cart/checkout required |

## Current architecture (before)

- Products fetched at build time by `src/lib/stripe-catalog.ts` (server-only, React
  `cache`-memoized, `STRIPE_SECRET_KEY` required at build), mapped onto `Product` in
  `src/types/index.ts:1-19`, statically prerendered everywhere (`generateStaticParams`,
  no `revalidate`/`dynamic` anywhere).
- Deploys to Cloudflare Workers via `@opennextjs/cloudflare` (OpenNext); two-Worker model
  in `wrangler.jsonc` (`env.production` → `emilys-flowers-production`, `env.preview` →
  `emilys-flowers-preview`), `WORKER_SELF_REFERENCE` service binding present, **no R2/D1/DO
  bindings**.
- `open-next.config.ts` is `defineCloudflareConfig({})` with R2 incremental cache commented
  out. `next.config.ts` has CSP, empty `images.remotePatterns`, and the unconditional
  `initOpenNextCloudflareForDev()` import.
- Only one server route: `POST /api/checkout` (Stripe Checkout, inline `price_data`,
  simulated-success fallback when no secret). No server actions.
- Tests: unit tests in `src/lib/__tests__` (incl. `stripe-catalog.test.ts`); Playwright E2E
  asserting live catalog counts **36 flowers / 3 bouquets** (`e2e/flowers.spec.ts`,
  `e2e/bouquets.spec.ts`).
- `UNDER_CONSTRUCTION` gate (`src/lib/under-construction.ts`) baked at build; production
  Worker env var arms the API 503.

## The contract to preserve (critical)

`src/lib/stripe-catalog.ts` exposes exactly 4 functions consumed by pages/components:

- `getAllProducts()` — `src/app/products/[slug]/page.tsx` (generateStaticParams, metadata), `src/app/sitemap.ts`
- `getProductBySlug(slug)` — `src/app/products/[slug]/page.tsx`
- `getProductsByCategory('flower'|'bouquet')` — `src/app/flowers/page.tsx`, `src/app/bouquets/page.tsx`
- `getFeaturedProducts()` — `src/components/home/FeaturedBouquets.tsx`

`Product` shape (`src/types/index.ts:1-19`): `id, slug, name, description, price (cents),
images: string[], category: 'flower'|'bouquet', tags: string[], featured?,
featuredOrder?, inStock, flowerType?, color?`.

Rules:
- New `src/lib/payload-catalog.ts` must keep this exact 4-function surface and the `Product`
  shape (may extend, must not remove fields — `sanitizeStoredCart` in `cart-context.tsx`
  validates the exact shape against localStorage carts; removing a field drops old carts).
- `price` stays **integer cents**; `id` today is the Stripe product id — a Payload id is
  fine, stale carts are structurally revalidated but will reference old products.
- Keep `slugify` (exported, unit-tested) and slug dedupe; move them into the new module.

## Phased plan

### Phase 0 — Prerequisites & verifications (do these first, they gate everything)

1. **Next 16 compat**: official template `templates/with-cloudflare-d1` is **Next 15 +
   Payload 3.82**. Verify `withPayload()` + `@payloadcms/next` work with this repo's
   Next **16.2.12** before committing to the design. Read
   `node_modules/next/dist/docs/` for this version's actual semantics.
2. **OpenNext ISR on installed version**: repo has `@opennextjs/cloudflare ^1.20.2`.
   Confirm open issue **#1281** (unstable ISR after 1.19.2 — spurious STALE) does not
   reproduce with a minimal ISR spike before building everything on it.
3. **Paid Workers plan** confirmed on the account (hard requirement for the single-Worker
   path — bundle ~19-21 MiB vs 3 MiB free limit).
4. Create `feature/payload-cms` worktree; keep `main` green.

#### Phase 0 results (verified 2026-08-03, PR #108)

1. **Next 16 compat — PASS (pin Payload ≥3.85).** `@payloadcms/next` peer-deps accept
   `next >=16.2.2 <17.0.0` from Payload 3.82.0 onward, and the Payload docs list
   `16.2.6+` as the supported floor — so use the current 3.x line (3.85+, latest 3.87.0),
   **not** the template's 3.82.1. Classic ISR (`export const revalidate`,
   `generateStaticParams`, `dynamicParams`) is fully supported and un-deprecated in
   16.2.12 (installed docs verified). **`revalidateTag(tag)` single-arg is deprecated
   (TypeScript error) — the two-arg `revalidateTag(tag, 'max')` form is required.**
   Caveats carried into the plan: the `with-cloudflare-d1` template is still Next 15 +
   Payload 3.82.1 (untested on Next 16 — re-verify `withPayload`'s injected webpack
   config under Turbopack on 16.2.12); replace the pino-pretty logger with the template's
   console logger; **do not enable Hyperdrive on the D1 binding** (it's the #14656 admin-
   auth trigger).
2. **OpenNext ISR — on-demand revalidation is the path; time-based ISR is risky on
   1.20.2.** Issue **#1281 (spurious STALE) is still OPEN and unfixed** (fix PR #1303 is a
   draft). The SWR stale-window guard exists in the installed 1.20.2 tag caches, but the
   regional-cache `shouldLazilyUpdateOnCacheHit` bug remains — **avoid
   `withRegionalCache`**. **Plan correction: go on-demand-only** (`revalidateTag`
   webhook + Payload hooks, no `export const revalidate` TTL) until #1303 lands. Also
   monitor **#1295** (`bypassTagCacheOnCacheHit` can serve stale entries after an on-demand
   `revalidateTag`) and #1284 (R2 populate flakiness). Import paths, `populate-cache
   remote`, and `--keep-vars`/`--preview-alias` forwarding are all confirmed against the
   installed package (see "ISR wiring (exact)").
3. **Paid Workers plan — CONFIRMED** on the account (bundle ~19-21 MiB vs 3 MiB free).
4. **Worktree `feature/payload-cms` — exists**, clean tree, `main` green.

Open at Phase 1: the empirical deploy spike (minimal ISR page + `populate-cache remote`,
assert `revalidateTag('products','max')` busts a cached page on the deployed Worker) was
deferred out of Phase 0 — the research above already answers the architecture questions it
was meant to settle. Run it as a Phase 1 gate before wiring real collections if any doubt
remains about #1295 behavior.

### Phase 1 — Stand up Payload

1. Add deps: `payload`, `@payloadcms/next`, `@payloadcms/db-d1-sqlite`,
   `@payloadcms/storage-r2`. (Add `@payloadcms/plugin-stripe` only in Phase 5.)
   Lockfile is `bun.lock` — use `bun add`.
2. `src/payload.config.ts`: collections `products` (fields mirroring the `Product` shape:
   name, slug, description, priceCents, category, tags, featured/featuredOrder, inStock,
   flowerType, color, media), `media`, auth `users` for admin.
3. Mount admin at `src/app/(payload)/` route group (`admin/[[...segments]]`,
   `api/[...slug]`, `layout.tsx`) per the template.
4. `next.config.ts`: wrap with `withPayload(nextConfig, { devBundleServerPackages: false })`;
   add `serverExternalPackages: ['jose', 'pg-cloudflare']` (partial fix for the admin-auth
   issue #14656); `images.localPatterns: [{ pathname: '/api/media/file/**' }]`.
5. Replace the pino logger (Node-only, breaks Workers) with a console logger.
6. **Seed script** replacing `scripts/create_flower_products.ts`: recreate **36 flowers /
   3 bouquets** so E2E count assertions stay valid. Make the 36/3 seed a documented contract.
7. D1 + R2 bindings (details in "ISR wiring" below).

#### Phase 1 results (verified 2026-08-03, PR #108)

All six Payload packages pinned to **3.87.0** (`payload`, `@payloadcms/next`,
`@payloadcms/db-d1-sqlite`, `@payloadcms/storage-r2`, `@payloadcms/richtext-lexical`,
`@payloadcms/ui`). Implemented: `src/payload.config.ts` (template's config incl. inline
console JSON logger, `sqliteD1Adapter`, `r2Storage`, `getCloudflareContextFromWrangler`);
collections `users`/`media`/`products` (`src/collections/`); admin route group
`src/app/(payload)/` (layout, `admin/[[...segments]]`, `api/[...slug]` — **no GraphQL
routes**, per workerd #5175); `tsconfig.json` gains `@payload-config` alias;
`next.config.ts` wraps `withPayload(nextConfig, { devBundleServerPackages: false })` +
`serverExternalPackages: ['jose', 'pg-cloudflare']` + `images.localPatterns`; D1/R2
bindings added to all three wrangler stanzas; `open-next.config.ts` enables
`r2IncrementalCache` + `d1NextTagCache`; 36/3 seed contract in
`scripts/seed_payload.ts`; `example.env` documents `PAYLOAD_SECRET`.

**3.87.0 deviations from the Next-15 template (all verified against installed types):**
1. `r2Storage` goes in `plugins: [...]` — the `storage:` config key does **not** exist in
   3.87 (`storage` is the v4 shape).
2. `(payload)/admin/[[...segments]]/not-found.tsx` imports `generatePageMetadata` (not
   `generateMetadata`) from `@payloadcms/next/views`.
3. No webpack `extensionAlias` block — withPayload 3.87 handles Turbopack; add none.
4. `cloudflare-env.d.ts` (from `bun run cf-typegen`) **must not be committed yet**: the
   generated workerd runtime types make `Body.json<T>()` return `unknown`, breaking the
   existing `src/app/checkout/checkout-page-client.tsx` (`response.json()` results become
   `unknown`). `payload.config.ts` types D1/R2 via narrow `Parameters<...>` casts instead.
   Re-run `cf-typegen` + fix `checkout-page-client.tsx` casts when the bindings actually
   need typed env access.

**CRITICAL dev-runtime finding — Bun cannot run `next dev` with Payload:** Turbopack
(Next 16.1+) emits **hashed external-module names** (`pkg-<hash>`, symlinked under
`.next/dev/node_modules/`) for `serverExternalPackages` entries, and **only Node resolves
them** (vercel/next.js#86652 fixed Node-side in 16.1.0-canary.10; **oven-sh/bun#25370
remains open — no Bun workaround**). The `with-cloudflare-d1` template never hits this
because its `dev` script runs `next dev` under Node. Our `dev` script is therefore
`next dev --no-server-fast-refresh` (Node runtime — do NOT use `bun run --bun next dev`),
and `--no-server-fast-refresh` is also the official Payload requirement for Next 16.2+
HMR (payload#16074). Do **not** set `devBundleServerPackages: true` to "fix" this — it
only delays the crash to the next external (`jose`), slows dev compiles (bundles Payload's
thousands of modules), and the official docs recommend `false`. This is also why
`AGENTS.md`'s Commands section now documents the Node runtime for `bun run dev`.

**Verification:** `bunx tsc --noEmit` 0 errors; `bun test` 130/130 green; dev smoke —
`/`, `/flowers`, `/admin`, `/admin/collections/products` all 200; `POST /api/checkout`
empty-items still 400 (no route-group shadowing); zero `Failed to load external module` /
`missing secret key` errors (admin fully initializes once `PAYLOAD_SECRET` is set).
Remaining dev caveats: `payload generate:importmap` is needed before media upload works
(storage-r2 client handler not yet in importMap — fine until Phase 3/R2 exists), and dev
must set `PAYLOAD_SECRET` (OpenNext's `initOpenNextCloudflareForDev` intentionally skips
`.env*`/`.dev.vars` — `envFiles: []` — so the secret comes from the shell env or
`example.env`).

### Phase 2 — Data-layer swap

1. New `src/lib/payload-catalog.ts` with the same 4 functions (memoized with React `cache`
   or per-request read, per the ISR model — prefer per-request reads of D1 so revalidation
   sees fresh data).
2. New pure mapper `mapPayloadProduct` → `Product` (replaces `mapStripeProduct`).
3. Delete `src/lib/stripe-catalog.ts`. **No consumer changes** — verify with a grep for
   `@/lib/stripe-catalog` after deletion.

### Phase 3 — Images & CSP

- `ProductImage.tsx` (`src/components/shop/ProductImage.tsx`) already falls back to the
  category SVG on error — keep.
- Remote CMS media (e.g., `*.payloadcms.com` or your media host): add to
  `next.config.ts` `images.remotePatterns` **and** the CSP `img-src` directive
  (`next.config.ts:9`). Known open issue **#15502**: Next image optimization breaks via
  OpenNext static-asset routing — workaround `images.unoptimized: true` or absolute URLs.

### Phase 4 — Build, CI, local env

- `deploy.yml` (both build steps) + `test.yml`: drop build-time `STRIPE_SECRET_KEY` env,
  add CMS reachability/creds or a pre-build D1 seed/migrate step. Build-time Stripe GitHub
  secrets become obsolete (keep runtime secrets).
- `playwright.config.ts`: swap the build env to Payload test creds/URL.
- Local env files (`.env`, `.env.dev`, `.env.preview`, `.env.production`, `.dev.vars`) +
  the tracked template (`example.env` — note: AGENTS.md says `.dev.vars.example` is
  tracked, which is currently inaccurate; fix that doc line while here). New vars:
  `PAYLOAD_SECRET`, CMS URL/API key, D1/R2 names.
- **Deploy step**: add `opennextjs-cloudflare populate-cache remote` after each deploy
  (initializes the `revalidations` table + uploads build cache entries).

### Phase 5 — Stripe sync (optional, scope-creep guard)

`@payloadcms/plugin-stripe` v3.85 does two-way sync via hooks + webhooks
(`STRIPE_WEBHOOKS_ENDPOINT_SECRET`, `/api/stripe/webhooks`). **Caveat**: webhooks process
asynchronously — in serverless the worker may terminate mid-handler; docs recommend
proxying. Decide source-of-truth (Payload vs Stripe) explicitly before enabling. This
phase can be deferred indefinitely; the catalog works without it.

### Phase 6 — Tests

- Replace `stripe-catalog.test.ts` with `mapPayloadProduct` + `slugify` tests.
- All other unit tests build `Product` fixtures directly — untouched unless the shape
  changes.
- E2E: `flowers.spec.ts` (36) / `bouquets.spec.ts` (3) stay valid **only if the seed
  matches**; add a Payload-backed test fixture or seeded D1 for E2E. Watch cache
  invalidation behavior in E2E (ISR caching can mask/retain content between tests).

### Phase 7 — Docs

- `AGENTS.md` (Data & state, Stripe, Testing, Deployment sections), `docs/README.md`,
  `docs/stripe-checkout.md`. Update the `.dev.vars.example` inaccuracy noted above.

## ISR wiring (exact)

### `open-next.config.ts`

Today `defineCloudflareConfig({})` defaults all three caches to `"dummy"` (verified in
installed adapter: `dist/api/config.js:45-62`) — ISR will not persist without overrides.
Canonical on-demand-only config (confirm import paths against installed 1.20.2):

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
// tag cache for on-demand revalidation:
//   import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
//   (or doShardedTagCache)

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  tagCache: d1NextTagCache,
  // Queue: NOT required for on-demand-only to update content — without an override the
  // dummy queue makes stale requests fall back to a BLOCKING re-render (fresh content on
  // next visit, but no stale-serve + background-regenerate, no dedupe/retry). Verified
  // in installed 1.20.2 (cacheInterceptor falls back to `return event` when
  // queue.send throws). Add `memory-queue` (per-isolate, needs WORKER_SELF_REFERENCE,
  // no DO migration) or `doQueue` (durable; adds durable_objects + migrations to all
  // three wrangler stanzas) if stale-while-revalidate serving is wanted. Start without
  // one; revisit if admin-generated pages feel slow.
});
```

The R2 override is a **singleton**, binding hard-coded to `NEXT_INC_CACHE_R2_BUCKET`
(prefix via `NEXT_INC_CACHE_R2_PREFIX`, default `incremental-cache`).

### `wrangler.jsonc` — add to ALL THREE stanzas (base, `env.production`, `env.preview`)

R2/D1/DO bindings are **non-inheritable** (like `assets`/`services`/`images`/`observability`
already repeated per env). Mind the `WORKER_SELF_REFERENCE` per-env trap (each env points at
its own worker name).

```jsonc
"r2_buckets": [{ "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "<name>" }],
"d1_databases": [{ "binding": "NEXT_TAG_CACHE_D1", "database_name": "<name>", "database_id": "<id>" }],
// if time-based ISR is ever added: durable_objects + migrations for NEXT_CACHE_DO_QUEUE
```

Add `PAYLOAD_SECRET` to `vars` or as a runtime secret per Worker, and the D1/R2 bindings
Payload itself needs (`D1`, `R2`).

### Pages

- `export const revalidate = 3600` (or chosen TTL) on `src/app/flowers/page.tsx`,
  `src/app/bouquets/page.tsx`, `src/app/products/[slug]/page.tsx`; keep
  `generateStaticParams`. Sitemap (`src/app/sitemap.ts`) needs the tag invalidation too.
- **Runtime-only first-request generation is the pattern**: do NOT rely on build-time D1
  data (empty at build → baked `null`). Unvisited/new slugs generate on first request and
  cache.

### Revalidation trigger

- `src/app/api/revalidate/route.ts`: POST, shared-secret auth (env var), validates a
  `tag`/`path`, calls `revalidateTag('products', 'max')` (**two-arg form — single-arg is
  deprecated in Next 16**) or `revalidatePath(path)`. Return 400/401/200 appropriately.
- Payload `afterChange`/`afterDelete` hooks on `products` call the same revalidation
  in-process (same Worker) — but the admin request context has the open auth bug, so the
  webhook route is the reliable primary path.

## Verification strategy

- **Phase 0 spike**: minimal ISR page + `populate-cache remote`; assert (a) no #1281
  behavior, (b) `revalidateTag('products', 'max')` busts a cached page on the deployed
  Worker (not just dev).
- Per-phase: `bun test` stays green throughout; `bun run test:e2e` after Phase 2/6;
  `bunx tsc --noEmit`.
- Deploy-check: `bun run build` succeeds **without** build-time `STRIPE_SECRET_KEY`
  (after Phase 2), and `UNDER_CONSTRUCTION` still gates production (see risk below).
- E2E counts (36/3) as the seed contract check.

## Known risks & blockers

| Risk | Detail | Mitigation |
|---|---|---|
| Admin auth on Workers | **#14656 open/reopened** (Payload 3.64+; admin Server Actions can't validate `payload-token` cookie; Hyperdrive caching stale auth tokens is a root cause). `serverExternalPackages: ['jose', 'pg-cloudflare']` is a partial fix | Use webhook route as primary revalidation path; if blocking, disable Hyperdrive caching on the DB connection; last resort: split hosting (Payload on Node host) |
| Paid plan requirement | Bundle ~19-21 MiB > 3 MiB free limit | Confirm paid plan in Phase 0 |
| Build-time D1 empty | Static prerender at build bakes `null` from unseeded D1 | Runtime-only first-request generation; seed before build only if build-time data is required |
| `UNDER_CONSTRUCTION` semantics change | Today baked at build; under ISR, regenerated pages read the **live worker env** (more correct, but cached HTML can hold stale construction state until revalidated) | Note behavior change; construction flips need a cache purge or full revalidation |
| OpenNext ISR stability | **#1281** spurious STALE after 1.19.2 — **still open/unfixed on 1.20.2** (fix PR #1303 draft); affects time-based ISR + regional cache; **#754** historical revalidate-ignored-on-dynamic (nominally closed, fix version never stated); **#1295** `bypassTagCacheOnCacheHit` can serve stale after on-demand `revalidateTag`; **#1284** `populate-cache remote` flakiness | Go **on-demand-only** (no `export const revalidate` TTL) on 1.20.2; avoid `withRegionalCache`; verify webhook revalidation in the Phase 1 spike; re-check #1295 before relying on cached admin edits |
| Next images on Workers | **#15502** open/verified — `/api/media` served via static assets breaks Next image optimization | `images.unoptimized: true` or absolute media URLs |
| Cache Components | OpenNext bugs #1130, #1225, #1223; PPR+interception broken | Stay on classic ISR; treat `use cache` as a later migration |
| Next 16 template gap | Official template is Next 15 | Phase 0 verification |
| GraphQL on Workers | Not guaranteed (workerd #5175) | Not needed — don't rely on it |
| Stale localStorage carts | `sanitizeStoredCart` validates exact `Product` shape | Don't remove `Product` fields |
| Webhook async on serverless | Payload Stripe webhooks may terminate mid-handler | Proxy webhooks via own endpoint if Phase 5 is attempted |

## Open questions for the implementing agent

- ~~Exact import paths for `r2IncrementalCache` / `d1NextTagCache` / `doShardedTagCache`
  in the installed `@opennextjs/cloudflare` 1.20.2~~ — **answered (Phase 0):** the package
  `"./*"` export map resolves them (see "ISR wiring (exact)").
- ~~Whether `populate-cache remote` is still the correct command name in 1.20.2~~ —
  **answered (Phase 0):** `populate-cache {local,remote}` exists, and `deploy`/`upload`
  auto-run `populate-cache remote`; it also creates the D1 `revalidations` table.
- ~~Decide the `revalidate` TTL value and whether `products` needs time-based ISR at all~~ —
  **decided (Phase 0):** no time-based TTL on 1.20.2 (#1281 open); on-demand-only via
  webhook + hooks. Revisit when #1303 lands.
- Stripe product ids (`Product.id`) — keep as-is or switch to Payload ids; affects stale
  carts only cosmetically.
- With `withRegionalCache` ruled out, is a regional/edge cache desired later (queue +
  Cache API) — out of scope until #1281/#1303 resolve.

## Suggested skills for future agents

- `worktrees` — required protocol for the `feature/payload-cms` lane (bare-repo layout).
- `verification-planning` — before starting Phase 1, per the non-trivial scope.
- `clonedeps` — to inspect `@opennextjs/cloudflare` / `payload` internals during wiring.
- `code-review` — before merging the worktree back to `main`.
- `adversarial-test-sweep` — for the mapper/seed test hardening in Phase 6.
- `maintainable-code` / `strong-types` — passive guidance while writing the Payload
  collections and mapper.

## Sources (research, Aug 2026)

- payloadcms.com/docs (installation, sqlite, plugins/stripe); github.com/payloadcms/payload
  (README, templates/with-cloudflare-d1, issues #14656 / #15094 / #15502 / #14716)
- blog.cloudflare.com/payload-cms-workers (2025-09-30)
- opennext.js.org/cloudflare/caching + /cloudflare (2026-05-20);
  opennextjs/opennextjs-cloudflare #659 / #700 / #702 / #1130 / #1225 / #1281 / #754
- nextjs.org/docs revalidatePath + revalidating (16.2.12); nextjs.org/blog/next-16
- This repo's installed adapters/docs: `node_modules/next/dist/docs/`,
  `node_modules/@opennextjs/cloudflare`, `node_modules/@opennextjs/aws/dist/types/open-next.d.ts`
