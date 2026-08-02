# Adversarial test risk ledger — cart/order/checkout sweep

## Campaign contract

- Target: `src/lib` pure-logic units (order math/validation/encoding, format, products data+helpers, cart reducer + seams + hydration, under-construction, reduced-motion) and the E2E suite (`e2e/*.spec.ts`).
- Baseline revision and dirty state: `429a86a` (clean tree before sweep).
- Audit-only or authorized changes: **authorized** — test edits and minimal product-code repairs for confirmed defects (per the sweep charter: "repair confirmed defects, preserve each failure as a deterministic regression").
- Supported environments: bun 1.3.14, TypeScript 6, Next 16.2.12, React 19.2.8, Playwright 1.62 chromium, macOS.
- Focused and full-suite commands: `bun test src/lib/__tests__/<file>`, `bun test`, `bunx tsc --noEmit`, `bun run test:e2e`.
- Budgets: unit suite stays < 1s (142 tests ≈ 20ms); generated loops bounded (existing 500/1000 draws); E2E one full run; no fuzz/property/mutation/coverage tooling installed — techniques limited to boundary/partition, manual oracle, and cross-boundary E2E.
- Allowed effects: local only. Forbidden: network, Stripe API, production, destructive remote effects.
- Abort conditions: E2E build failure → stop E2E lane and report.
- Required repeated-run count and variants: unit ×3; tsc; E2E ×1 (parallel 4 workers).

## Status vocabulary

`pending` / `covered` / `confirmed-defect` / `excluded` / `escalated` / `unresolved`

## Risk rows

| ID | Contract or invariant | Source and consequence | Adversarial hypothesis | Oracle | Evidence/gap before | Technique and budget | Priority | Status and disposition |
|---|---|---|---|---|---|---|---|---|
| R-001 | `decodeOrderItems` returns only semantically valid line items; a crafted `items` URL param must not surface negative/fractional/zero/blank items | `src/lib/order.ts:isLineItem`; success-page receipt totals | Lax shape check (types only) admits price −500, quantity 0/−3/1.5, empty ids/names → negative/fractional receipt totals | Decode of each invalid item equals `[]`; mixed payload keeps only valid members | Probe: lax items decoded and subtotal went −500 | Boundary/partition table, 12 cases | High | `confirmed-defect` — fixed (`isLineItem` mirrors `validateLineItems`); 12 unit regressions prove red-before/green-after; E2E invalid-items test proves cross-boundary |
| R-002 | Cart quantities are always positive integers (badge, order math, Stripe payload) | `cartReducer` `UPDATE_QUANTITY` guard was `<= 0` only | NaN/Infinity/fractional quantity slips through and is serialized as `null` into localStorage | Reducer removes the line for any non-positive-integer quantity | Probe: NaN/1.5/Infinity kept | Boundary cases ×3 + 2 non-effect locks | High | `confirmed-defect` — fixed guard (`<= 0 || !Number.isInteger`); 3 regressions fail against old code |
| R-003 | Hydration of a corrupted/hand-edited localStorage cart degrades gracefully (never `NaN` totals or crashes) | `CartProvider` hydrate effect accepted any array | Stored item missing `product.price` → `toLineItems` yields `undefined` → `$NaN` totals; missing fields break rendering | `sanitizeStoredCart` drops malformed items; cart renders empty/trimmed | Probe: malformed hydrate → total NaN | Fault-injection at persistence seam + partition table | High | `confirmed-defect` — added exported `sanitizeStoredCart` (full-shape check), used at hydrate; 10 unit tests + E2E corrupted-store test |
| R-004 | `getPriceRange` never returns non-finite bounds | FilterBar `min`/`max` attributes; exported util | Empty list → `[Infinity, -Infinity]` | `getPriceRange([]) === [0, 0]`; catalog → `[2199, 14999]` | Zero test coverage; probe showed `[null, null]` after JSON | Boundary ×4 | Medium | `confirmed-defect` (latent, unreachable today) — fixed; 4 tests incl. order-invariance property |
| R-005 | `prefersReducedMotion` reflects the live media query in browsers | `src/lib/reduced-motion.ts` | Browser branch never executed by the suite | Stubbed `window.matchMedia` true/false/absent maps to true/false/false | Only SSR/no-window case tested | Stubbed-global partition ×4 | Medium | `covered` — 3 browser-branch tests added (function correct, no change) |
| R-006 | `validateLineItems` rejects every malformed payload class with the documented error | `/api/checkout` boundary | Non-array objects/strings, item strings/arrays/numbers, NaN/Infinity prices and quantities, extra fields, duplicates | Each returns the documented `{ok:false,...}` or `{ok:true}` | Several partitions untested (all probed correct) | Partition table ×11 | Medium | `covered` — locks added; no product change needed |
| R-007 | Under-construction gate arms only on literal `"true"` (exact match) | `isUnderConstruction`; production safety gate | Leading/trailing space or mixed case silently disarms (fail-open) or arms the gate | `" true"`, `"true "`, `"True"` → false | Untested | Boundary ×3 | Low | `covered` — locks added. **Escalated recommendation:** consider `trim()` so a stray space can't fail the gate open (deferred — no confirmed defect; flag to owner) |
| R-008 | Encode/decode round-trip is base64url-safe and UTF-8-safe | checkout success URL | `+`, `/`, `=`, non-ASCII names | Round-trip equality + no `+ / =` in output | Covered | Existing tests | High | `covered` (existing) |
| R-009 | Order numbers: `EF-XXXXXX`, unambiguous alphabet, effectively unique | simulated checkout | Collisions, forbidden chars | Regex + alphabet scan ×500 + uniqueness ×1000 | Covered | Existing tests | Low | `covered` (existing) |
| R-010 | Order math: `computeLineItemTotal`/`Count`/`Shipping` incl. $50 threshold boundaries | money path | 4999/5000/5001, empty, multi-item | Exact sums; 599/0/0 | Covered | Existing tests | High | `covered` (existing) |
| R-011 | Product data invariants (counts, unique ids, integer prices, in-stock, images local+per-category) | catalog + rendering | Data drift breaks pages | Per-invariant asserts | Covered | Existing tests | Medium | `covered` (existing) |
| R-012 | `formatPrice` decimal formatting | all price display | Rounding artifacts | Exact strings | Covered | Existing tests | Medium | `covered` (existing); non-integer input out of contract |
| R-013 | `toLineItems` flatten preserves order and never mutates input | cart→checkout seam | Reorder/mutation | Deep equality + no mutation | Covered | Existing tests | High | `covered` (existing) |
| R-014 | `bunx tsc --noEmit` clean | CI hygiene | Stale `.next/dev/types` referenced removed `/products/[slug]` route | tsc exit 0 | Baseline FAILED before sweep | Regenerate `.next` | Medium | `harness finding` (pre-existing, generated-state only) — resolved via `next typegen`; no tracked change needed; documented in report |
| R-015 | E2E quantity/price assertions not coupled to brittle class strings | cart page specs | Class rename breaks tests falsely | Dedicated test id | `[class*="flex h-8 w-10..."]` in 2 specs | Harness hardening | Low | `covered` — added `data-testid="cart-item-quantity"`; residual smell: `[class*="tabular-nums"]` count asserts in bouquets/flowers specs (accepted, documented) |
| R-016 | Success page shows a coherent receipt and hides the summary for invalid payloads (cross-boundary) | checkout success flow | Crafted URL renders garbage totals | Totals visible & correct for valid param; no summary for invalid | Only happy-path E2E existed | 2 cross-boundary E2E tests | High | `covered` — added; both green |

## Findings and replay packets

- F1 (R-001) — **product defect** (robustness/spec drift): `decodeOrderItems` accepted semantically invalid line items; docs claimed strict schema. Reproducer: `items` param = base64url of `[{"id":"x","name":"X","price":-500,"quantity":1}]` → subtotal −500. Repair: `isLineItem` mirrors `validateLineItems`. Regressions: `order.test.ts` (11 failing against old code) + E2E invalid-items test.
- F2 (R-002) — **product defect** (invariant): NaN/Infinity/1.5 quantities kept; serialized to localStorage as `null`. Reproducer: `UPDATE_QUANTITY {quantity: NaN}` → item retained with `quantity: null` in JSON. Repair: integer guard. Regressions: `cart-reducer.test.ts` (3 failing against old code).
- F3 (R-003) — **product defect** (robustness): corrupted store hydrated as-is → `$NaN` totals. Reproducer: stored `[{"product":{"id":"x","name":"Broken"},"quantity":1}]` → `toLineItems` price `undefined` → total NaN. Repair: `sanitizeStoredCart` at hydrate. Regressions: `cart-hydration.test.ts` (10 tests) + E2E corrupted-store test.
- F4 (R-004) — **product defect** (latent): `getPriceRange([])` → `[Infinity, -Infinity]`. Repair: `[0, 0]`. Regression: `products.test.ts` (fails against old code).
- F7 (R-014) — **harness/environment**: stale `.next/dev/types` referenced a removed route, breaking `bunx tsc --noEmit` at baseline. Resolved by `rm -rf .next && bunx next typegen`. Not a repo defect; `.next` is gitignored.

## Closure check

- Every row covered (existing or new evidence), fixed, or explicitly escalated.
- F1–F4 have minimal deterministic regressions proven to fail against pre-fix code.
- Every retained test has a distinct partition/transition/oracle.
- Verification: `bun test` ×3 (142 pass), `bunx tsc --noEmit` clean, `bun run test:e2e` 25/25 pass.
- Residual: non-integer `formatPrice` input (out of contract), empty/overflow price caps on `validateLineItems` (no upper bound — Stripe rejects > 99999999 cents/999999 qty server-side), `tabular-nums` count locators, `isUnderConstruction` trim recommendation (owner decision).
