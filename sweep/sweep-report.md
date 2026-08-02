# Adversarial test sweep report — cart/order/checkout

## Outcome

- Status: **clean within scope** — 4 confirmed defects repaired with durable regressions; suite strengthened; all declared verification green.
- Target and scope: `src/lib` pure-logic units (order math/validation/encoding, format, products data+helpers, cart reducer + seams + hydration, under-construction, reduced-motion) and the Playwright E2E suite.
- Baseline revision and dirty state: `429a86a` (clean tree at start).
- Authority: tests editable + product fixes editable (confirmed defects only).
- Environments and toolchain: macOS, bun 1.3.14, TypeScript 6, Next 16.2.12, React 19.2.8, Playwright 1.62 (chromium), Stripe SDK (never contacted).
- Execution budgets and abort conditions: unit < 1s (measured ≈ 20ms); E2E single run (parallel 4 workers); abort on E2E build failure (did not occur).

## Baseline

- Focused command `bun test`: **99 pass / 0 fail / 2725 expects / 26ms**, 9 files.
- Broad `bunx tsc --noEmit`: **FAILED at baseline** — `TS2307` in `.next/dev/types/validator.ts` referencing a removed `src/app/products/[slug]` route (stale gitignored generated state; resolved by `rm -rf .next && bunx next typegen`). Not a repo defect.
- E2E: 22 existing tests (not run before changes; run after).

## Risk ledger summary

| Status | Count | Highest-risk rows or notes |
|---|---:|---|
| Covered | 11 | R-005..R-013, R-015, R-016 (new locks + existing evidence) |
| Confirmed defect | 4 | R-001 decode schema, R-002 quantity guard, R-003 hydration sanitize, R-004 price-range empty |
| Excluded | 1 | R-012 non-integer `formatPrice` input (out of contract); overflow price caps (server-side Stripe rejects) |
| Escalated | 1 | R-007 `isUnderConstruction` trim consideration (owner decision) |
| Unresolved | 0 | — |

## Findings and regressions

1. **decodeOrderItems schema laxness (F1, R-001)** — product defect. Crafted `items` URL param with negative/zero/non-integer price or quantity (or empty/blank id/name) decoded successfully and produced negative/fractional receipt totals. Docs claimed strict behavior; code didn't. **Repair:** `isLineItem` now mirrors `validateLineItems` (non-empty trimmed id/name, positive-integer price/quantity). **Regressions:** 12 partition cases in `order.test.ts`; E2E "no order summary for an invalid items param". Proven red-before (11 fails against stashed pre-fix code).
2. **UPDATE_QUANTITY invalid quantities (F2, R-002)** — product defect. NaN/Infinity/fractional quantities passed the `<= 0` guard and were stored (serializing as `null` to localStorage). **Repair:** guard is now `quantity <= 0 || !Number.isInteger(quantity)` (removes the line). **Regressions:** 3 tests in `cart-reducer.test.ts`; proven red-before. Also locked two non-effects (nonexistent id, unrelated items untouched).
3. **Cart hydration of corrupted stores (F3, R-003)** — product defect. Any JSON array hydrated as-is; a store missing `product.price` produced `$NaN` totals and broken rendering. **Repair:** new exported `sanitizeStoredCart` (full-shape per-item validation) applied at the hydrate seam. **Regressions:** 10 tests in `cart-hydration.test.ts`; E2E "corrupted stored cart degrades to an empty cart".
4. **getPriceRange([]) → [Infinity, -Infinity] (F4, R-004)** — latent product defect in an exported util (unreachable today; called only with the static catalog). **Repair:** `[0, 0]` for empty. **Regressions:** 4 tests in `products.test.ts` (incl. order-invariance); proven red-before.
5. **Stale `.next` types break tsc (F7, R-014)** — harness/environment, pre-existing. Resolved by regenerating generated types; no tracked change. Future hygiene note in Residual risk.

## Suite changes

| Test or group | Added / strengthened / consolidated / removed | Distinct behavior or evidence |
|---|---|---|
| `order.test.ts` | strengthened (+12) | decode strictness: negative/zero/fractional price & quantity, blank id/name, mixed-payload filtering |
| `cart-reducer.test.ts` | strengthened (+5) | NaN/Infinity/fractional removal; nonexistent-id non-effect; unrelated items untouched |
| `cart-hydration.test.ts` | added (10) | sanitizeStoredCart: non-arrays, per-field shape, quantity domain, mixed garbage |
| `products.test.ts` | strengthened (+4) | getPriceRange min/max, single, empty, order-invariance |
| `checkout.test.ts` | strengthened (+11) | validateLineItems: non-array classes, item classes, NaN/Infinity, lenient extra fields, duplicates |
| `reduced-motion.test.ts` | strengthened (+3) | browser branch: reduce/no-preference/no-matchMedia |
| `under-construction.test.ts` | strengthened (+3) | exact-match contract: whitespace + case |
| `cart.spec.ts` (E2E) | strengthened (+1, 2 locators de-brittled) | corrupted-store hydration; quantity via `data-testid` |
| `checkout.spec.ts` (E2E) | strengthened (+2) | success-page totals for valid param; no summary for invalid param |
| `CartItem.tsx` | +1 line | `data-testid="cart-item-quantity"` (test support only) |
| Probe file | removed | `__probe.test.ts` — falsification-only, not retained |

No tests removed; nothing consolidated.

## Verification evidence

- `bun test` ×3: **142 pass / 0 fail / 2791 expects / ≈20ms** each run.
- `bunx tsc --noEmit`: **exit 0** after `.next` regeneration (and again after the E2E build).
- `bun run test:e2e`: **25/25 passed (12.1s)** — full suite incl. checkout flow, cart flows, all 3 new regressions.
- Durability: F1/F2/F4 regressions re-run against pre-fix code via `git stash` — failed as expected (11, 3, and 1 failures respectively); green after restore.
- Mutation/coverage/fuzz/race tooling: **not installed** — no claims from those. Boundary/partition oracles and cross-boundary E2E used instead.

## Residual risk and limits

- **Untested:** browser-branch animation code (GSAP, petal burst), `ProductImage` error fallback, under-construction rendering path (production-only env; unit-tested at the gate level only).
- **Specification gaps:** `validateLineItems` has no upper bound on price/quantity (Stripe rejects > 99999999¢ / > 999999 qty server-side → 500); non-integer `formatPrice` input is out of contract; `generateOrderNumber` uniqueness is probabilistic (space ≈ 7×10⁸, threshold 990/1000 draws).
- **Escalated to owner:** `isUnderConstruction` is exact-match on `"true"`; a stray whitespace in the env var silently fails the gate open. Consider `trim()`. Tests now document the exact-match contract either way.
- **Known smell (accepted):** `bouquets.spec.ts`/`flowers.spec.ts` price assertions rely on `[class*="tabular-nums"]` element counts (11/5) — brittle to future components reusing that class; kept because the count is a real contract and the false-failure risk is low.
- **Excluded:** performance, load, chaos, security/penetration, production mutation, Stripe API contact, cross-browser (chromium only).
- **Claims this sweep does not establish:** race freedom, leak freedom, exhaustive coverage, absence of other defects, correctness of the Stripe integration (never exercised live).
