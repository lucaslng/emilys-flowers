# Testing

> **Read this before adding or modifying tests.** Two layers: **bun test** for
> unit tests and **Playwright** for E2E. Both are wired and must stay green.

## Unit tests (bun test)

- Live in `src/lib/__tests__/*.test.ts` and are pure-logic (no DOM, no TSX
  rendering) — they test the Stripe→`Product` mapping and slug derivation
  (`stripe-catalog.test.ts`), the client-safe listing helpers
  (`product-utils.test.ts`), the exported `cartReducer`, the `toLineItems`
  seam, and the extracted pure helpers (`formatPrice` in `src/lib/format.ts`;
  `computeLineItemTotal` / `computeLineItemCount` / `computeShipping` and
  `validateCheckoutItems` in `src/lib/order.ts`).
- Use `import { test, expect, describe } from "bun:test"`. The `@/*` path alias
  resolves automatically (bun reads `tsconfig.json` paths).
- No happy-dom / testing-library — keep unit tests dependency-free; if a
  component needs DOM rendering, that belongs in E2E, not here.

## E2E tests (Playwright)

- Live in `e2e/*.spec.ts` and use `@playwright/test`. `playwright.config.ts`
  runs `bun run build && bun run start` on `:3000` (production build, per
  Next.js guidance) with a chromium project and `baseURL http://localhost:3000`.
- Prefer web-first assertions (`expect(locator).toBeVisible()` /
  `toContainText()`) — they auto-wait and absorb the `template.tsx` page-enter
  animation.
- To put items in the cart, drive the real UI (navigate to `/bouquets`, click
  "Add to Cart") rather than injecting `localStorage`, except for narrow edge
  cases where `page.addInitScript` is clearer.

### Checkout E2E intercepts both checkout APIs

`playwright.config.ts` builds with `STRIPE_SECRET_KEY` (the catalog is
fetched from Stripe at build time); runtime credentials are irrelevant because
the specs intercept both network hops with `page.route()`:
`POST /api/checkout` is fulfilled with a success URL, and
`GET /api/checkout/session` is fulfilled with a sanitized receipt fixture.
**E2E must never hit the real Stripe API.**

Success URLs carry only `session_id` — no `items=`/`shipping=` params (there
is no simulated checkout path; see [stripe-checkout.md](./stripe-checkout.md)).
Route behavior (validation, catalog resolution, 503-when-unconfigured) is
covered by unit tests: input validation lives in `validateCheckoutItems`
(`src/lib/order.ts`: `{productId, quantity}` wire shape, positive-integer
quantities capped at 99), and `checkout-route.test.ts` asserts the
empty-items 400 error string `"No items provided"` — keep it stable.

`checkout-route.test.ts` mocks `@/lib/catalog-index` so catalog resolution
never touches Stripe, and asserts that Stripe `line_items` and the ChitChats
shipment payload are built from catalog-resolved names/prices.
`checkout-session-route.test.ts` covers the success-retrieval surface
(`GET /api/checkout/session`): cs_ id format guard, sanitized projection, and
the no-leak guarantee for customer_details/metadata. It reuses the shared
`stripe` mock from `order-emails-mocks.ts` — bun's `mock.module` registry is
process-global across test files, so test files must not register a second
`stripe` mock (see the note in `order-emails-mocks.ts`; `checkout-route.test.ts`
predates this rule and runs its own per-file mock).

E2E specs assert the live test-catalog counts (36 flowers, 3 bouquets) — update
them if the Stripe catalog changes. E2E builds run without Flagship
credentials, so `enable-flowers-page` fails open to enabled (flowers catalogue
visible) and `under-construction` fails open to off (store renders normally) in
E2E.

## Accessibility (WCAG 2.2 AA, axe-core)

`e2e/accessibility.spec.ts` uses `@axe-core/playwright` (devDependency) to scan
every public route (`/`, `/flowers`, `/bouquets`, a product page, `/cart`,
`/checkout`, `/checkout/success`) plus the open mobile nav, asserting zero
violations with the five WCAG tags (`wcag2a`, `wcag2aa`, `wcag21a`,
`wcag21aa`, `wcag22aa`). No axe rules are disabled. The same spec also covers
keyboard-only and focus-not-obscured checks.

- Running it needs `STRIPE_SECRET_KEY` in the process env (Playwright
  auto-loads `.env` from the test root; in CI the e2e job gets it from the
  `preview` GitHub Environment) or the build fails.
- Axe scans must wait for the `template.tsx` page-enter animation and
  ScrollTrigger reveals to settle — the `settlePage` helper scrolls in steps
  with pauses, because an instant jump down the page misses mid-page reveals
  and never settles.
- Note: axe-core has no rule for 2.4.11 Focus Not Obscured; that SC is covered
  by the manual focus-obscured check in the same spec.

## Runner separation & generated dirs

- **`bunfig.toml`** excludes `e2e/**` from `bun test` discovery so the two
  runners don't collide. `bun test` runs only unit tests; `bun run test:e2e`
  runs only Playwright.
- **Generated dirs** `test-results/` and `playwright-report/` are gitignored.
  Browser binaries live outside the repo (installed via
  `bunx playwright install chromium`).

## Writing testable code

When adding source that should be unit-testable as pure logic, export the
function (as `cartReducer`, `formatPrice`, `computeCartTotal`,
`computeCartItemCount`, `computeShipping`, and `validateCheckoutItems` are
exported) rather than reaching for a DOM test harness. Price formatting goes
through `formatPrice` (`src/lib/format.ts`); cart/order math and the
free-shipping threshold ($50 = 5000¢) go through the `compute*` helpers in
`src/lib/order.ts` — don't re-inline `(x / 100).toFixed(2)` or
`subtotal >= 5000 ? 0 : 599` in components. `formatPrice` (`src/lib/format.ts`)
is the only price formatter.