# Data & State

> **Read this before touching product data, the cart, prices, or order math.**
> There is no DB/CMS — products come from the Stripe catalog at build time.

## Products — Stripe catalog at build time

Products come from the **Stripe catalog**, fetched at build time by the
server-only module `src/lib/stripe-catalog.ts` (no DB/CMS). It calls
`stripe.products.list({ expand: ['data.default_price'] })`, maps each product +
price onto the `Product` shape (slug derived from name, category from
`metadata.category`, `flower_type`/`color` from metadata,
`featured`/`featuredOrder` from `metadata.featured`, price from
`default_price.unit_amount`), and memoizes the result with React `cache` so the
catalog is fetched once per build.

- A single universal `PLACEHOLDER_DESCRIPTION` is used when a Stripe product
  has no description.
- Helpers: `getAllProducts`, `getProductBySlug`, `getProductsByCategory`,
  `getFeaturedProducts`.
- Client-safe pure helpers (`getPriceRange`, `getFlowerTypes`,
  `getFlowerColors`, `formatLabel`) live in `src/lib/product-utils.ts`.
- Images are scanned at build time from per-product folders under
  `public/products/<slug>/` by `imagesForProduct` (`src/lib/stripe-catalog.ts`),
  falling back to the per-category SVG placeholder (`/placeholders/flower.svg`,
  `/placeholders/bouquet.svg`) when the folder is missing; the product detail
  page shows a gallery of all images. `ProductImage`
  (`src/components/shop/ProductImage.tsx`) still falls back to the category SVG
  on image-load error.
- `next.config.ts` `images.remotePatterns` is empty (no remote hosts).
- Because the catalog is fetched at build time, `STRIPE_SECRET_KEY` must be
  present during `next build` (see `docs/deployment.md`).

## Prices — integer cents

Prices are **integer cents** (Stripe convention): `2499` = $24.99. All
order/cart math stays in cents; the pure helpers live in `src/lib/order.ts`.
Display formatting goes through `formatPrice` (`src/lib/format.ts`), which
returns the decimal string (no `$`); callers add the symbol. The free-shipping
threshold ($50 = 5000¢, else flat $5.99 = 599¢) lives in `computeShipping`
(`src/lib/order.ts`) — `CartSummary`, `checkout/page.tsx`, and
`checkout/success/page.tsx` all call it, so don't re-inline the ternary.

## Cart — Context + useReducer + localStorage

Cart is React Context + `useReducer` in `src/lib/cart-context.tsx`, persisted
to `localStorage` key `emilys-flowers-cart` (hydrated client-side on mount).

- Hydrated payloads pass through `sanitizeStoredCart` (exported, unit-tested)
  so a corrupted/hand-edited store drops malformed items instead of poisoning
  totals; `UPDATE_QUANTITY` keeps only positive-integer quantities (anything
  else removes the line).
- `useCart()` throws if used outside `CartProvider` (which lives in the root
  layout, so this is normally fine).
- The `cartReducer`, the `toLineItems` seam, and `sanitizeStoredCart` are
  exported from that module for isolated unit testing.
- The order math (`computeLineItemTotal`, `computeLineItemCount`,
  `computeShipping`) and `validateLineItems` live in `src/lib/order.ts` and
  operate on the flat `LineItem` shape; the provider's `getTotal`/`getItemCount`
  flatten `CartItem[]` to `LineItem[]` via `toLineItems` and delegate to them.
- `decodeOrderItems` enforces the same semantic shape as `validateLineItems`
  (non-empty id/name, positive-integer price/quantity, quantity ≤
  `MAX_LINE_ITEM_QUANTITY` = 99), so a crafted `items`
  URL param can't surface negative/fractional totals on the success page.

## Checkout — server-side price resolution

The checkout client POSTs only `{productId, quantity}` pairs (plus the address)
to `/api/checkout` — never names or prices. The route validates the wire shape
with `validateCheckoutItems` (`src/lib/order.ts`: non-empty array, non-empty
`productId`, positive-integer quantity capped at 99) and then resolves every
`productId` against the **live Stripe catalog** via `getCatalogIndex()`
(`src/lib/catalog-index.ts`): a pure, Workers-safe index of product id →
`{priceId, name, unitAmount}` fetched with `products.list({active: true,
expand: ['data.default_price']})` and memoized at **module scope** (one Stripe
call per cold isolate). Unknown product ids are rejected with a 400. Stripe
`line_items` use the resolved Price objects (`price:` form, not inline
`price_data`), and the ChitChats shipment payload is built from the same
resolved items.

Real checkout success URLs carry only `session_id={CHECKOUT_SESSION_ID}`; the
success page fetches its receipt from `GET /api/checkout/session`, which
format-checks the id before calling Stripe and returns a sanitized projection
(`items/subtotal/shipping/total/orderNumber` — never customer_details or
metadata). The no-key simulated path keeps the legacy `items=` URL param for
local dev/E2E synthetic URLs.