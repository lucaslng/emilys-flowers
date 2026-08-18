# Order Emails (Resend)

> **Read this before touching `src/lib/email.ts`, `src/app/api/webhooks/stripe/route.ts`,
> `src/app/admin/orders/**`, or anything that sends email.** This doc covers the
> two-email order lifecycle: an automatic confirmation on checkout, and a
> manually-triggered shipping notification.

## Flow overview

1. **Checkout completes** → Stripe fires `checkout.session.completed` to
   `POST /api/webhooks/stripe` → the webhook sends the customer an **order
   confirmation** email (via Resend) with their items, totals, and shipping
   address.
2. **You review the order** at `/admin/orders` (password-gated). Each paid
   order shows its items, totals, and shipping address.
3. **You confirm + ship** → you type an estimated shipping time into the
   order's inline form → `POST /api/admin/orders/[sessionId]/ship` sends the
   customer a **shipped** email with that estimate, and stamps
   `shipped_at` / `shipping_estimate` onto the Stripe session's metadata so
   the admin page shows a "Shipped" badge.

Emails are sent from `Emily's Flowers <hello@emilysflowers.ca>` (the verified
Resend domain).

## Files

| File | Purpose |
|---|---|
| `src/lib/email.ts` | `sendOrderConfirmationEmail` / `sendShippedEmail` — Resend SDK wrappers, HTML/text builders, escaping, `formatPrice` |
| `src/app/api/webhooks/stripe/route.ts` | Stripe webhook receiver; verifies signature, maps session → confirmation email |
| `src/app/admin/orders/page.tsx` | Server-rendered admin order list (password-gated, `force-dynamic`) |
| `src/app/admin/orders/admin-login.tsx` | Client island: password → `POST /api/admin/login` |
| `src/app/admin/orders/ship-form.tsx` | Client island: estimate input → `POST /api/admin/orders/[sessionId]/ship` |
| `src/app/api/admin/login/route.ts` | Sets the `admin_session` httpOnly cookie (sha256 of `ADMIN_PASSWORD`) |
| `src/app/api/admin/orders/[sessionId]/ship/route.ts` | Sends the shipped email + persists metadata |

## Environment variables

| Variable | Where used | Notes |
|---|---|---|
| `RESEND_API_KEY` | `src/lib/email.ts` | Send-only API key. Missing → email functions throw. |
| `STRIPE_WEBHOOK_SECRET` | webhook route | `whsec_...`. Missing → dev-mode skips signature verification (with a warning); set it in prod. |
| `ADMIN_PASSWORD` | admin login + ship route + admin page | Any non-empty string. Missing → admin page shows a config error. |

All three are **server-only** (never `NEXT_PUBLIC_`). `RESEND_API_KEY` and
`ADMIN_PASSWORD` are read at runtime on the Worker, so they must be deployed
as `wrangler secret put` per Worker (see [deployment.md](./deployment.md)).
`STRIPE_WEBHOOK_SECRET` is only read by the webhook route at runtime — same
story.

## Webhook details

- Route: `POST /api/webhooks/stripe` (dynamic, no `force-dynamic` needed —
  POST handlers are dynamic by default).
- Signature verification: `stripe.webhooks.constructEventAsync(rawBody, sig,
  STRIPE_WEBHOOK_SECRET)`. Fails → 400. When the secret is unset (local dev),
  verification is skipped with a warning so `stripe listen` works without
  copying the secret.
- On `checkout.session.completed`: retrieves the session with
  `expand: ['line_items', 'customer_details', 'shipping_details']`, maps it
  with the exported pure function `mapCheckoutSessionToConfirmation(session)`,
  and sends the confirmation with `Idempotency-Key: <event.id>` (Resend
  dedupes Stripe's webhook retries).
- If the session has no customer email, the event is logged and skipped
  (200) — nothing to send to.
- Email send failures are caught and logged; the handler still returns 200 so
  Stripe doesn't retry a webhook whose email already failed (the idempotency
  key already dedupes genuine retries).
- All other event types → `200 { received: true }`.

### Local testing

```bash
# Terminal 1 — forward Stripe events to the local webhook
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Terminal 2 — run the app (needs RESEND_API_KEY in .env)
bun run dev
```

`stripe listen` prints a `whsec_...` secret; you can either set
`STRIPE_WEBHOOK_SECRET` in `.env` or leave it unset (dev-mode skip). Complete
a test checkout with card `4242 4242 4242 4242` and the confirmation email
arrives.

## Admin page details

- URL: `/admin/orders`. Server component with
  `export const dynamic = 'force-dynamic'` (reads cookies + Stripe at request
  time — must never prerender). `robots` metadata: `index: false`.
- Auth: the page and the ship route compare the `admin_session` cookie
  against `sha256(ADMIN_PASSWORD)`. The login route uses a constant-time
  `timingSafeEqual` compare and sets the cookie `httpOnly`, `sameSite: lax`,
  `secure` in production.
- Order list: latest 25 paid Checkout Sessions (`expand: ['data.line_items']`),
  filtered to `payment_status === 'paid'`, sorted newest first. Each card
  shows session id, date, customer name/email, line items, totals, shipping
  address, and either a "Shipped — <estimate>" badge (when
  `metadata.shipped_at` exists) or the inline ship form.
- Ship form: one labeled input ("Estimated shipping time", placeholder
  "2–4 business days"). On success the route sends the shipped email and
  persists `metadata: { shipped_at, shipping_estimate }` on the session; the
  page reloads after a ~1s success message.

## Notes / gotchas

- **stripe-node v22 type gap:** `Checkout.Session` has no `shipping_details`
  property in the v22 types. Both the webhook route and the admin page use a
  local intersection cast:
  `type SessionWithShippingDetails = Stripe.Checkout.Session & { shipping_details?: { name: string; address: Stripe.Address } | null }`.
- `customer_details` / `shipping_details` are not actually expandable in the
  Stripe API — they're always present on a retrieved session; the `expand`
  entries are harmless and Stripe ignores them.
- Shipping cost comes from `session.total_details?.amount_shipping ?? 0`
  (v22 has no top-level `amount_shipping`).
- The success page copy ("A confirmation is on its way to your inbox") is now
  true — the webhook sends it.
- No DB: order state lives on the Stripe session (metadata + payment status).