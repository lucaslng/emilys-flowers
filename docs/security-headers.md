# Security Headers & CSP

> **Read this before touching `next.config.ts` security headers, the CSP
> policy, or `experimental.sri`.** The CSP/inline-script/SRI interaction is
> subtle — an agent that "tightens" CSP by dropping `'unsafe-inline'` will
> break hydration.

## Current state

`next.config.ts` bakes a `Content-Security-Policy` header and a set of
security headers into every response. Because `next.config.ts` is evaluated
at **build time**, the CSP is fixed per deployment — `VERCEL_ENV` at build
determines which variant ships:

| Build env | `script-src` |
|---|---|
| **Production** (`VERCEL_ENV=production`) | `'self' 'unsafe-inline' https://js.stripe.com` |
| **Preview** (`VERCEL_ENV=preview`) | `'self' 'unsafe-inline' https://js.stripe.com https://vercel.live` |
| **Dev** (`NODE_ENV=development`) | `'self' 'unsafe-inline' https://js.stripe.com https://vercel.live 'unsafe-eval'` |

There is no `src/app/proxy.ts` or `middleware.ts`. All pages are statically
prerendered (no `dynamic`/`connection()`/`generateStaticParams` opt-outs).

## SRI does not replace `'unsafe-inline'`

This is the trap that prompted this doc.

**Subresource Integrity (SRI)** and **CSP inline-script authorization** are
different mechanisms:

- **SRI** adds `integrity="sha256-…"` attributes to **external** `<script src>`
  tags so the browser can verify the file wasn't modified in transit. It does
  nothing for inline `<script>…</script>` blocks — there's no `src` to hash.
- **`'unsafe-inline'`** (or a nonce, or a per-script hash) in `script-src`
  authorizes **inline** scripts to execute. Without it, every inline script
  is blocked.

Next.js/React emit many inline scripts that are core to hydration and cannot
be removed:

- `self.__next_f.push([…])` — the RSC (React Server Components) payload
- `$RB` / `$RV` / `$RC` — React's streaming retry / resumption machinery
- `requestAnimationFrame(function(){$RT=performance.now()})` — route
  transition timing hint

Dropping `'unsafe-inline'` from `script-src` (expecting SRI to cover it)
produces console errors like:

> Executing inline script violates the following Content Security Policy
> directive… Either the `'unsafe-inline'` keyword, a hash
> (`'sha256-7mu4H…'`), or a nonce is required.

The browser offers a per-script hash, but that's impractical: there are many
inline scripts, and their hashes change every build.

**The correct setup is both together**: `'unsafe-inline'` authorizes the
framework's inline scripts; SRI protects external scripts from tampering.
They're complementary, not alternatives.

## `'unsafe-eval'` is dev-only

Per the [Next.js CSP guide](../node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md),
React uses `eval` only in development to reconstruct server-side error stacks
in the browser. Production builds (including Vercel **preview** builds, which
are production builds) don't need it.

The gate is `NODE_ENV === 'development'`, **not** `!isProduction`. Gating on
`!isProduction` would enable `eval` on Vercel previews — an unnecessary
over-permission. `NODE_ENV` is the right signal because it's `'development'`
only for `bun run dev` (local).

## `experimental.sri`

```ts
experimental: {
  sri: {
    algorithm: 'sha256', // or 'sha384' or 'sha512'
  },
},
```

App Router only, experimental. At build time, Next.js computes the hash of
each external chunk and adds `integrity="sha256-…"` to the `<script>` tag.
The browser refuses to execute the script if the fetched file's hash doesn't
match — protecting against CDN/transport tampering.

Limitations (per the docs):

- **Experimental** — may change or be removed.
- **App Router only** — not supported in Pages Router.
- **Build-time only** — cannot hash dynamically generated scripts.

## Why not nonces?

A nonce-based CSP (`'nonce-<random>'` per request, no `'unsafe-inline'`) is
the strictest option, but it requires **dynamic rendering on every page**:

- Each request generates a fresh nonce → pages can't be statically generated.
- Static optimization, ISR, and PPR are disabled.
- Pages can't be cached by CDNs without additional configuration.
- Slower initial loads, higher server load.

For this storefront (fully static, no `proxy.ts`/`middleware`), that's a real
performance hit. We keep `'unsafe-inline'` + SRI instead. If compliance
requirements ever mandate strict CSP, add `src/app/proxy.ts` generating a
per-request nonce and force dynamic rendering — see the Next.js CSP guide's
nonce example.

## Directive-by-directive rationale

### `script-src`

```
script-src 'self' 'unsafe-inline' https://js.stripe.com [vercel.live] ['unsafe-eval']
```

- `'self'` — same-origin scripts (Next.js chunks).
- `'unsafe-inline'` — Next.js/React inline scripts (see above).
- `https://js.stripe.com` — Stripe.js client.
- `https://vercel.live` — Vercel Live toolbar (non-production only, #16).
- `'unsafe-eval'` — dev only (see above).

### `worker-src`

```
worker-src 'self' blob: https://m.stripe.network
```

Stripe Radar (fraud detection) spawns web workers off `blob:` URLs and
`https://m.stripe.network` to collect device fingerprint signals. Without
`worker-src`, browsers fall back to `default-src 'self'`, blocking the worker
and **silently disabling fraud signals**. No error is surfaced — Radar just
stops working. (#14)

### `frame-src`

```
frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com [vercel.live]
```

Stripe checkout iframes + Vercel Live toolbar (non-production). Previously the
toolbar's script+connect were allowed but its iframe was blocked by
`frame-src`, producing a CSP violation and a broken toolbar on preview. (#16)

### `connect-src`

```
connect-src 'self' https://api.stripe.com https://r.stripe.com https://m.stripe.com https://v3.stripe.com [vercel.live wss://vercel.live]
```

Stripe API + telemetry endpoints. `wss://vercel.live` is the Live toolbar's
WebSocket (non-production).

### `frame-ancestors 'none'`

No origin may embed this site in an iframe — anti-clickjacking. (Also
enforced by `X-Frame-Options: DENY` for older browsers.)

### `form-action 'self' https://checkout.stripe.com`

Allows forms to POST only to self or Stripe checkout. Prevents exfiltration
via form submission to attacker origins.

### `object-src 'none'`

No plugins/embedded objects (`<object>`, `<embed>`, `<applet>`). Modern
defense — none are used, so block entirely.

## COEP / CORP / COOP

### `Cross-Origin-Embedder-Policy-Report-Only: credentialless`

**Report-only, not enforcing.** Stripe does not support cross-origin
isolation — `checkout.stripe.com` iframes do not send the COEP/CORP headers
required to be embedded under an enforcing COEP, so `credentialless` OR
`require-corp` would break checkout
([Stripe docs](https://docs.stripe.com/security/guide#cross-origin-isolation-support)).

Shipping report-only first surfaces would-be violations without blocking
anything. Promote to enforcing once Stripe supports it. A `report-to`
endpoint can be wired up later via the Reporting API. (#15)

### `Cross-Origin-Resource-Policy: same-origin`

**Enforced.** Restricts which cross-origin documents can embed **our**
resources. Safe because it governs how others load us, not how we load
Stripe. (#15)

### `Cross-Origin-Opener-Policy: same-origin-allow-popups`

Keeps the window reference isolated but allows popups (needed for the
Stripe Checkout redirect flow, which opens `checkout.stripe.com`).

## Other headers

| Header | Value | Why |
|---|---|---|
| `X-Frame-Options` | `DENY` | Anti-clickjacking (legacy browsers; `frame-ancestors 'none'` is the modern equivalent). |
| `X-Content-Type-Options` | `nosniff` | Blocks MIME-type sniffing. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Full referrer only same-origin; origin-only cross-origin; none on downgrade. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=(), payment=(), usb=()` | Denies access to sensitive browser APIs. `payment=()` is safe here because checkout is a full-page redirect to Stripe's origin — see `docs/stripe-checkout.md` → "Permissions-Policy: payment" before changing it. |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | 2-year HSTS including subdomains. |