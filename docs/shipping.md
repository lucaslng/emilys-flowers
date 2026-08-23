# ChitChats Shipping

> **Read this before touching `src/lib/chitchats.ts`, the ChitChats wiring in
> `src/app/api/checkout/route.ts`, the webhook's shipping-address fallback, or
> the admin "View shipment" link.** ChitChats has **no standalone rates
> endpoint** — rates only come back when a shipment is created with
> `postage_type: "unknown"`.

## Flow overview

1. **Address collected on our checkout page.** The checkout client POSTs
   `{ items, address }` to `/api/checkout`, where `items` are
   `{productId, quantity}` pairs only — names/prices are resolved server-side
   from the Stripe catalog (see `src/lib/catalog-index.ts`). The address shape
   is `{ name, line1, line2?, city, province, postalCode }` (province = 2-letter
   CA code; `line2` is the optional apartment/unit line — sent to ChitChats as
   `address_2` only when present). Stripe's `shipping_address_collection` is
   **removed** from the Checkout Session so the customer isn't asked for the
   address twice.
2. **Shipment auto-created to get rates.** When `STRIPE_SECRET_KEY` and the
   ChitChats credentials are configured, the route validates the address,
   builds a create-shipment payload (`postage_type: "unknown"`, `ship_date:
   "today"`) from **catalog-resolved** names/prices/subtotal — never raw
   client values — and POSTs it to ChitChats. The payload describes the goods
   clearly for customs: a shipment-level `description` plus per-line
   descriptions (`{product} - handmade decorative ribbon flower
   arrangement`); ChitChats builds the customs declaration from the line
   items when present, so those per-line descriptions are what land on it.
   Weight is estimated at **250g per product with no base weight**
   (`estimateShipmentWeight`). The response's `rates` array is the only way
   to get rates.
3. **Cheapest rate charged as a Stripe shipping option.** The route picks the
   rate with the lowest `payment_amount` (string dollars, total to charge:
   postage + insurance + taxes + fees) and adds it as a single
   `shipping_rate_data` fixed-amount option on the Checkout Session.
4. **Shipment stays "unpaid" until postage is bought.** Creating the shipment
   only *quotes* rates — it does not purchase postage. The owner buys postage
   and prints labels manually in the ChitChats dashboard (see "Manual postage
   purchase" below).

The route **fails closed**: if the shipment can't be created or no rate comes
back, it returns `502` with
`"We couldn't calculate shipping right now. Please try again."` — it never
silently falls back to the old flat-rate shipping.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `CHITCHATS_CLIENT_ID` | yes (for real shipping) | ChitChats client id, used in the URL path `/api/v1/clients/{id}/shipments` |
| `CHITCHATS_ACCESS_TOKEN` | yes (for real shipping) | **Bare token — no `Bearer` prefix** (see auth gotchas) |
| `CHITCHATS_BASE_URL` | no | Defaults to `https://chitchats.com`. Set to `https://staging.chitchats.com` for the sandbox. |

These are **server-only** runtime secrets — set them per Worker via
`wrangler secret put` (see [deployment.md](./deployment.md)). They are never
exposed to the client.

## Staging vs production

- **Sandbox:** `CHITCHATS_BASE_URL=https://staging.chitchats.com` with
  staging credentials. This repo's `example.env` points at staging.
- **Production:** omit `CHITCHATS_BASE_URL` (defaults to
  `https://chitchats.com`) or set it explicitly, with live credentials.

The admin "View shipment" link is built from the same base plus the client id
and shipment id — `{base}/clients/{clientId}/shipments/{shipmentId}` — so it
follows the environment automatically (the API's `tracking_url` is stored in
metadata but not used for the link).

## Auth gotchas

- The `Authorization` header is the **bare access token**:
  `Authorization: <CHITCHATS_ACCESS_TOKEN>`. ChitChats rejects
  `Bearer <token>`.
- `Content-Type: application/json; charset=utf-8`.
- No idempotency keys — dedupe is via `order_id` (we send our `EF-XXXXXX`
  order number). No webhooks. Rate limit is 2000 req/5min.
- Non-2xx responses look like `{ "error": { "message": "..." } }`; the client
  surfaces that message in the thrown `Error`.

## Rate selection

`pickCheapestRate` picks the rate with the lowest `payment_amount`
(string dollars). `parsePaymentAmountToCents` converts it to integer cents
(`"9.68"` → `968`) for Stripe's `fixed_amount`. ChitChats returns **no
currency field** — assume CAD (the account currency).

## Metadata stored on the Stripe session

When ChitChats is configured, the Checkout Session carries:

| Key | Value |
|---|---|
| `order_number` | `EF-XXXXXX` (as before) |
| `chitchats_shipment_id` | ChitChats shipment id |
| `chitchats_tracking_url` | `https://.../tracking/{id}` |
| `chitchats_postage_type` | the chosen rate's postage type |
| `shipping_address` | JSON `{ name, line1, city, province, postalCode }` |

The `shipping_address` JSON is the source of truth for the confirmation email
and the admin "Ship to:" line now that Stripe no longer collects the address
(`session.shipping_details` is null). The webhook's
`mapCheckoutSessionToConfirmation` parses it (guarded with try/catch → null)
and the admin page formats it with `formatMetadataShippingAddress`.

Success URLs carry no shipping amount — the receipt's shipping comes from
`GET /api/checkout/session` (the sanitized Stripe projection), so nothing
displayed can be altered by hand-editing the URL.

## Admin "View shipment" button

`/admin/orders` shows a **View shipment** link (styled like "View in Stripe",
`target="_blank" rel="noopener noreferrer"`) on each order card whose metadata
has `chitchats_shipment_id`. It points at the ChitChats dashboard shipment
page — `{CHITCHATS_BASE_URL}/clients/{CHITCHATS_CLIENT_ID}/shipments/{id}`
via `shipmentDashboardUrl` in `src/lib/chitchats.ts` — plus a small muted
`ChitChats {shipment_id}` label. The "Ship to:" line falls back to the parsed
`shipping_address` JSON when `shipping_details` is null.

## Fallback behavior when not configured

- **`STRIPE_SECRET_KEY` present, ChitChats not configured:** the route behaves
  exactly as before — a session with no `shipping_options`, no address
  required, no `shipping_address` metadata. (This is the pre-ChitChats
  behavior; the old flat-rate `computeShipping` remains only as the success
  page's defensive fallback for a missing receipt field.)
- **No `STRIPE_SECRET_KEY`:** the route returns `503 { error: 'Stripe is not
  configured.' }` — there is no simulated path.

## Manual postage purchase

Creating a shipment with `postage_type: "unknown"` only obtains rates — it
does **not** buy postage. The owner purchases postage and prints labels
manually in the ChitChats dashboard for now; automating that is future work.

## Cleanup of abandoned unpaid shipments

Every checkout attempt creates a ChitChats shipment, including ones the
customer never completes, and **there is NO dedupe**: each attempt generates a
fresh `order_number` and a fresh shipment, so a customer who retries checkout
leaves one or more orphan unpaid shipments behind. ChitChats has no webhooks
and no idempotency keys, and **no DELETE/cleanup is implemented** — abandoned
shipments accumulate as unpaid in the ChitChats dashboard and must be cleaned
up manually (or via a future scheduled job).