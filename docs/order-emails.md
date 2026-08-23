# Order Emails (Resend)

> **Read this before touching `src/lib/email.ts`, `src/app/api/webhooks/stripe/route.ts`,
> `src/app/admin/orders/**`, or anything that sends email.** This doc covers the
> two-email order lifecycle: an automatic confirmation on checkout, and a
> manually-triggered shipping notification.

## Flow overview

1. **Checkout completes** → Stripe fires `checkout.session.completed` to
   `POST /api/webhooks/stripe` → the webhook sends the customer an **order
   confirmation** email (via Resend) with their items, totals, and shipping
   address, and stamps `confirmation_email_sent_at` (+
   `confirmation_email_id`) onto the Stripe session's metadata.
2. **You review the order** at `/admin/orders` (OIDC-gated). Each paid
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
| `src/app/admin/orders/page.tsx` | Server-rendered admin order list (OIDC-gated, `force-dynamic`) |
| `src/app/admin/orders/admin-login.tsx` | **Removed** — the password login island no longer exists; replaced by the OIDC flow |
| `src/app/admin/orders/ship-form.tsx` | Client island: estimate input → `POST /api/admin/orders/[sessionId]/ship` |
| `src/lib/admin-auth.ts` | OIDC client + session JWT helpers: discovery, PKCE, token exchange, ID-token verification, group check |
| `src/app/api/admin/login/route.ts` | Redirects to the OIDC provider (authorization code + PKCE) |
| `src/app/api/admin/callback/route.ts` | OIDC callback: exchanges code, verifies ID token + groups claim, sets the `admin_session` JWT cookie |
| `src/app/api/admin/logout/route.ts` | Clears the `admin_session` cookie |
| `src/app/api/admin/orders/[sessionId]/ship/route.ts` | Format-checks `sessionId` (`cs_(live|test)`, shared helper in `src/lib/stripe-session-id.ts`; malformed → 400), then sends the shipped email + persists metadata |

## Environment variables

| Variable | Where used | Notes |
|---|---|---|
| `RESEND_API_KEY` | `src/lib/email.ts` | Send-only API key. Missing → email functions throw. |
| `STRIPE_WEBHOOK_SECRET` | webhook route | `whsec_...`. Missing outside production → signature verification is skipped (with a warning); missing in production → the webhook fails closed with 500. |
| `OIDC_ISSUER` | `src/lib/admin-auth.ts` | Provider issuer URL (e.g. `https://accounts.example.com`); discovery doc fetched at `{issuer}/.well-known/openid-configuration`. Missing → admin page shows a config error. |
| `OIDC_CLIENT_ID` | `src/lib/admin-auth.ts` | OIDC client ID. Missing → admin page shows a config error. |
| `OIDC_CLIENT_SECRET` | `src/lib/admin-auth.ts` | OIDC client secret. Missing → admin page shows a config error. |
| `ADMIN_SESSION_SECRET` | `src/lib/admin-auth.ts` | HS256 signing key for the session JWT (≥ 32 chars; generate with `openssl rand -base64 32`). Missing → admin page shows a config error. |
| `ADMIN_OIDC_GROUPS` | `src/lib/admin-auth.ts` | Comma-separated group names; the signed-in user must belong to at least one (provider must expose a `groups` claim in the ID token or userinfo). Missing → admin page shows a config error. |
| `BASE_URL` | `src/lib/admin-auth.ts` | The site's root URL (e.g. `https://emilysflowers.ca`); the OIDC callback URL is derived as `BASE_URL + /api/admin/callback` (the code appends the path). Optional in dev (falls back to the request origin); **required in production** (never derived from the Host header). The derived callback URL must match the one registered in the provider exactly. |

All of these are **server-only** (never `NEXT_PUBLIC_`). `RESEND_API_KEY`,
`STRIPE_WEBHOOK_SECRET`, and the OIDC vars are read at runtime on the Worker,
so they must be deployed as `wrangler secret put` per Worker (see
[deployment.md](./deployment.md)).

## Webhook details

- Route: `POST /api/webhooks/stripe` (dynamic, no `force-dynamic` needed —
  POST handlers are dynamic by default).
- Signature verification: `stripe.webhooks.constructEventAsync(rawBody, sig,
  STRIPE_WEBHOOK_SECRET)`. Fails → 400. When the secret is unset and
  `NODE_ENV !== 'production'` (local dev), verification is skipped with a
  warning so `stripe listen` works without copying the secret. In production a
  missing secret is a hard 500 — the webhook fails closed rather than
  accepting unsigned events.
- On `checkout.session.completed`: retrieves the session with
  `expand: ['line_items']` (the only expandable property), maps it
  with the exported pure function `mapCheckoutSessionToConfirmation(session)`,
  and sends the confirmation with the SDK's `idempotencyKey` request option
  set to `<event.id>` (sent as the HTTP `Idempotency-Key` header; Resend
  dedupes Stripe's webhook retries).
- If the session has no customer email, the event is logged and skipped
  (200) — nothing to send to.
- If the session's `payment_status` is not yet `'paid'` (async payment
  methods can settle after `checkout.session.completed` fires), the event is
  logged and skipped (200) — the confirmation email is only sent for sessions
  already `'paid'` at webhook time, matching the admin order list's
  `payment_status === 'paid'` filter. The handler does not listen for
  `checkout.session.async_payment_succeeded`, so an async-payment order that
  settles later never receives a confirmation email.
- Email send failures are caught and logged, and the handler returns **500** so
  Stripe auto-retries the webhook delivery with exponential backoff (up to ~3
  days, sequential). Duplicate sends are prevented two ways: Resend's
  `idempotencyKey` (24h window, dedupes in-window retries) and the app-level
  confirmation stamp (see below, dedupes later retries).
- On a successful send, the webhook stamps the confirmation state onto the
  session via `stripe.checkout.sessions.update`, setting
  `confirmation_email_sent_at` + `confirmation_email_id` while **merging** the
  existing metadata (never wiping `shipped_at` / `shipping_estimate` — the
  update replaces the whole map, so the current keys are spread in). Before
  sending, the webhook skips (200) when `metadata.confirmation_email_sent_at`
  already exists, so Stripe retries after the Resend idempotency window expires
  don't produce duplicate emails. The stamp goes through
  `stampConfirmationMetadata` (`src/lib/webhook-stamp.ts`), which retries the
  update up to 3 times with short backoff. If every attempt fails, the handler
  returns **500** so Stripe redelivers while Resend's idempotency key still
  dedupes (<24h); each redelivery re-attempts the stamp, and once it lands the
  app-level check dedupes any later (>24h) retries.
- All other event types → `200 { received: true }`.

### Local testing

```bash
# Terminal 1 — forward Stripe events to the local webhook
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Terminal 2 — run the app (needs RESEND_API_KEY in .env)
bun run dev
```

`stripe listen` prints a `whsec_...` secret; you can either set
`STRIPE_WEBHOOK_SECRET` in `.env` or leave it unset (dev-mode skip — only
outside production). Complete
a test checkout with card `4242 4242 4242 4242` and the confirmation email
arrives.

### Preview (test-mode) webhooks

Previews use Stripe **test keys**, and Stripe treats test mode as a separate
webhook world: test-mode events only reach webhook endpoints registered in
test mode, signed with that endpoint's test-mode `whsec_...` secret.

- Register a **test-mode** webhook endpoint pointing at the preview Worker's
  URL (e.g.
  `https://<branch>-emilys-flowers-preview.<subdomain>.workers.dev/api/webhooks/stripe`)
  and put its `whsec_...` into the preview Worker's `STRIPE_WEBHOOK_SECRET`.
- Preview URLs are **per-branch**, so the endpoint URL (and its signing
  secret) changes per branch. All preview branches share one preview Worker
  secret namespace, so only one `STRIPE_WEBHOOK_SECRET` can be active at a
  time — update it when switching which branch you're testing.
- **Never** point test-mode events at the production Worker: its live
  `whsec_...` won't verify a test-mode signature (400), and its live
  `STRIPE_SECRET_KEY` can't retrieve test sessions.
- Resend has no sandbox: preview sends **real** emails. Use a throwaway
  address in test checkouts.
- For most dev, `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
  is simpler than registering a per-branch endpoint.

## Admin page details

- URL: `/admin/orders`. Server component with
  `export const dynamic = 'force-dynamic'` (reads cookies + Stripe at request
  time — must never prerender). `robots` metadata: `index: false`.
- Auth: OIDC (authorization code + PKCE) via a generic provider. `GET
  /api/admin/login` redirects to the provider; the provider redirects back to
  `GET /api/admin/callback`, which exchanges the code for tokens, verifies the
  ID token against the provider's JWKS, and checks the user's `groups` claim
  against the `ADMIN_OIDC_GROUPS` allowlist. On success it sets the
  `admin_session` cookie — a signed JWT (HS256, 8h expiry) — `httpOnly`,
  `sameSite: lax`, `secure` in production — and redirects to `/admin/orders`.
  `GET /api/admin/logout` clears the cookie. The page and the ship route
  verify the `admin_session` JWT.
- Order list: latest 25 paid Checkout Sessions (`expand: ['data.line_items']`),
  filtered to `payment_status === 'paid'`, sorted newest first. Each card
  shows the order number (`metadata.order_number`, falling back to the session
  id), date, customer name/email, line items, totals, shipping
  address, and either a "Shipped — <estimate>" badge (when
  `metadata.shipped_at` exists) or the inline ship form.
- Ship form: one labeled input ("Estimated shipping time", placeholder
  "2–4 business days"). On success the route sends the shipped email and
  persists `metadata: { shipped_at, shipping_estimate }` on the session —
  **merged** with the existing metadata, so the webhook's
  `confirmation_email_sent_at` / `confirmation_email_id` stamps are preserved
  (the update replaces the whole map, so the current keys are spread in). The
  page reloads after a ~1s success message. The route is **idempotent**: if
  `metadata.shipped_at` already exists it returns 200 without sending a
  duplicate shipped email (duplicate submits are a benign no-op). If the
  metadata stamp itself fails, the route returns
  `500 { error, emailSent: true }` instead of swallowing the error — the form
  surfaces the server's message verbatim. Resubmitting within 24 hours is
  deduped by the `shipped-${sessionId}` email idempotency key and retries the
  stamp; after 24 hours a resubmit risks a duplicate shipped email.

### OIDC setup

- Register the callback URL in your OIDC provider:
  `https://emilysflowers.ca/api/admin/callback` in prod.
- Set `BASE_URL` to the site's root URL in production (e.g.
  `https://emilysflowers.ca`); it is **required** in prod — the callback URL
  is never derived from the request Host header there. The callback URL is
  derived as `BASE_URL + /api/admin/callback` and must match the URL
  registered in the provider exactly. In dev it's optional and falls back to
  the request origin.
- The provider must return a `groups` claim (in the ID token or userinfo);
  the signed-in user must belong to at least one group listed in
  `ADMIN_OIDC_GROUPS`.
- Generate the session signing key with `openssl rand -base64 32` and put it
  in `ADMIN_SESSION_SECRET` (≥ 32 chars).
- Preview Workers have **per-branch URLs**, so the callback URL differs per
  branch — same gotcha as the per-branch Stripe webhook URLs above. Set
  `BASE_URL` to the preview branch's root URL (e.g.
  `https://<branch>-emilys-flowers-preview.<subdomain>.workers.dev`) and
  register the derived callback URL (that root + `/api/admin/callback`) in the
  provider when testing a preview branch.

### `ADMIN_SESSION_SECRET` rotation runbook

`ADMIN_SESSION_SECRET` is the HS256 key that signs the `admin_session` JWT
cookie (`src/lib/admin-auth.ts`). There is **no server-side session
revocation**: logout only clears the cookie client-side
(`src/app/api/admin/logout/route.ts`), and the JWT carries no
`jti`/denylist/version claim. An exported cookie keeps working until its 8h
expiry — **rotating the secret is today's only kill switch**. Every
outstanding session JWT instantly fails signature verification against the new
value (`verifySessionToken` returns `null`, fail-closed), so the next admin
request redirects to the OIDC login.

**When to rotate:** suspected cookie exfiltration or admin compromise,
departure of someone with access to the secret (e.g. a Cloudflare dashboard
member), or periodic hygiene. The two Workers have independent secrets —
rotating one does not affect the other; rotate both unless an incident is
provably scoped to one environment.

**Procedure** (~2 minutes):

1. Generate a new secret (≥ 32 chars) and stash it somewhere safe until step 4
   — `wrangler secret put` replaces the old value with no undo:

   ```bash
   openssl rand -base64 32
   ```

2. Rotate on both Workers. The change takes effect immediately — no redeploy
   needed (when you do deploy later, keep passing `--keep-vars`, which every
   deploy requires — see [deployment.md](./deployment.md)):

   ```bash
   echo "<new-secret>" | bunx wrangler secret put ADMIN_SESSION_SECRET --env production
   echo "<new-secret>" | bunx wrangler secret put ADMIN_SESSION_SECRET --env preview
   ```

3. Verify: open `/admin/orders` in a browser that still holds a pre-rotation
   `admin_session` cookie — it must bounce to the OIDC login instead of
   rendering orders — then sign in again and confirm the order list renders.
4. Roll back only if you rotated to a broken value (e.g. < 32 chars → the
   admin page shows a config error and verification fails closed): re-put the
   stashed pre-rotation value from step 1. Never roll back to a *compromised*
   secret — generate another fresh one instead.

**Decision on targeted revocation (token-version claim): deferred (2026-08).**
Adding a version claim checked against a Workers KV/env value would allow
per-user invalidation without nuking all sessions. Deferred because this is a
single-admin storefront where sessions already expire after 8h, rotation is
rare and cheap, and targeted revocation would add a KV binding plus a
claim-check path on every admin request for a threat model that doesn't
currently justify it. Revisit if the site gains multiple admins, longer
session TTLs, or compliance requirements.

## Notes / gotchas

- **stripe-node v22 type gap:** `Checkout.Session` has no `shipping_details`
  property in the v22 types. Both the webhook route and the admin page use a
  local intersection cast:
  `type SessionWithShippingDetails = Stripe.Checkout.Session & { shipping_details?: { name: string; address: Stripe.Address } | null }`.
- `customer_details` / `shipping_details` are **not** expandable in the Stripe
  API — they're always present on a retrieved session. Listing them in
  `expand` makes Stripe reject the request with a 400 ("This property cannot
  be expanded"), so only `line_items` goes in the `expand` array.
- **Resend idempotency:** the key must be passed as the SDK's
  `idempotencyKey` **request option** (2nd arg to `emails.send`), NOT inside
  the payload's `headers` field — payload `headers` become email MIME headers
  and never reach the HTTP layer, so dedup silently never engages (this
  caused duplicate confirmation emails). Keys expire after 24h, and two
  concurrent sends with the same key return `409 concurrent_idempotent_requests`
  rather than silently deduping (Stripe webhook retries are sequential, so
  this is not a practical concern here).
- Shipping cost comes from `session.total_details?.amount_shipping ?? 0`
  (v22 has no top-level `amount_shipping`).
- The success page copy ("A confirmation is on its way to your inbox") is now
  true — the webhook sends it.
- No DB: order state lives on the Stripe session (metadata + payment status).