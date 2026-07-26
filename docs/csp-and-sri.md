# CSP & SRI: Hash-based inline-script policy

## The problem

The site's Content-Security-Policy had `'unsafe-inline'` in `script-src`. This
weakens CSP significantly: any injected inline script (via XSS or a compromised
dependency that writes a `<script>` element into the DOM) executes without
violating the policy. The site had no way to distinguish the application's
own inline scripts from an attacker's injected ones.

The accepted fix is to list every allowed inline script's content hash in the
CSP. The browser matches each `<script>` element's DOM text content against the
allowed hashes; scripts that don't match are blocked.

## Why SRI was investigated and rejected

Next.js ships an `experimental.sri` flag that adds `integrity` attributes to
externally-loaded `<script>` and `<link>` elements. However, SRI (Subresource
Integrity) is designed for external resources loaded via `src` or `href` — it
does not apply to inline `<script>` blocks. The inline flight-data scripts that
Next.js renders (e.g. `self.__next_f.push(...)`) have no `src` attribute, so
SRI cannot cover them.

An earlier upstream approach attempted to address this by running inline scripts
through the same integrity pipeline, but it encountered a fundamental mismatch:
SRI operates on byte-level responses fetched over HTTP, while inline scripts
have no network fetch and no response body to attach an `integrity` hash to.
The concept of "integrity for inline content" is what CSP hash sources
(`'sha256-...'`) were designed for — they hash the DOM text content of the
`<script>` element itself.

Additionally, a build-time CSP-hash injection feature is in development
upstream. When it ships, this roll-your-own approach can be replaced with the
native feature. Until then, the post-build script described here provides the
same guarantee.

## The hash-based CSP approach

A post-build script (`scripts/inject-csp-hashes.ts`) runs after `next build`:

1. Walks all `*.html` files in `.next/server/app/`.
2. For each file, extracts every inline `<script>...</script>` block (skipping
   scripts with a `src` attribute).
3. Computes `sha256` of the DOM text content and base64-encodes it.
4. Builds a per-page CSP string containing all directives (except
   `frame-ancestors`, which cannot go in `<meta>`).
5. Injects `<meta http-equiv="Content-Security-Policy" content="...">` into the
   `<head>` of each page.

Because each inline script's content includes chunk paths that themselves
contain content-hashed filenames (e.g.
`/_next/static/chunks/abc123.js`), the hashes change every build. There is no
cross-build stability requirement — each deploy ships its own HTML with
matching CSP hashes.

The build script chain in `package.json` is:

```json
"build": "bun run --bun next build && bun run --bun scripts/inject-csp-hashes.ts"
```

## The meta-vs-header split

The CSP is split across two delivery mechanisms:

| Mechanism | Directives | Rationale |
|-----------|-----------|-----------|
| HTTP header (`next.config.ts`) | `frame-ancestors 'none'`, `upgrade-insecure-requests` | `frame-ancestors` is not supported in `<meta>` CSP. `upgrade-insecure-requests` is duplicated as defense-in-depth. |
| `<meta>` tag (post-build script) | `default-src`, `script-src` (with hashes), `style-src` (with hashes or bare `'self'`), `img-src`, `font-src`, `connect-src`, `worker-src`, `frame-src`, `base-uri`, `form-action`, `object-src` | All other directives, computed per-page with hash sources for `<script>` blocks, `<style>` blocks, and `style="..."` attribute values. |

Both CSPs are enforced independently by the browser — a resource must satisfy
both to load. This split is safe because the two sets of directives have no
overlap in the directives they control.

## Post-build script design

`scripts/inject-csp-hashes.ts` is a single TypeScript file with zero external
dependencies — it uses only `node:crypto`, `node:fs`, `node:path`, and Bun's
`Glob` API.

The script hashes three categories of inline content:

| Category | Source | Entity handling | Example |
|----------|--------|----------------|---------|
| `<script>` blocks | Inline flight data, bootstrapping | Raw bytes (RAWTEXT state — no decoding) | `self.__next_f.push(...)` |
| `<style>` blocks | Framework error-page CSS | Raw bytes (RAWTEXT state — no decoding) | `:root { --next-error-*: ... }` |
| `style="..."` attrs | `next/image` fill positioning, error-page UI | **Decode entities** (attribute values ARE decoded) | `style="font-family:...&quot;...&quot;;"` |

The entity-decoding distinction is critical: `<script>` and `<style>` element
content is treated as raw text by the HTML parser (RAWTEXT / script-data state),
so HTML entities are NOT decoded. But `style="..."` attribute values ARE
subject to HTML entity decoding by the parser. The browser hashes the DOM
attribute value (after decoding), so the script must decode entities before
hashing attribute values.

The entity decoder handles `&quot;`, `&amp;` (last), `&lt;`, `&gt;`, `&#39;`,
`&nbsp;`, and numeric entities (`&#NNN;`, `&#xHH;`).

**Fail-safe behavior (security-critical):**

- If no `*.html` files are found in `.next/server/app/`, the script exits with
  code 1 (error). The build fails.
- If every HTML file has zero inline scripts, the script exits with code 1
  (the format may have changed and the CSP would have no hash sources).
- If a file has zero inline scripts but others do, a warning is printed to
  stderr but the build does not fail (e.g. `_global-error.html` might
  genuinely have no inline scripts).
- The script NEVER emits `'unsafe-inline'` in `script-src` or `style-src`. If
  hashes cannot be found, the build fails rather than falling back to an
  insecure policy.

**Hash computation:**

The browser hashes the DOM text content of `<script>` and `<style>` elements,
and the DOM attribute value of `style="..."` attributes. Inside `<script>` and
`<style>` elements, the HTML parser treats content as raw text (RAWTEXT or
script-data state) — it does NOT decode HTML entities. For `style="..."`
attribute values, the parser DOES decode HTML entities. The script handles
both cases correctly.

## Dropping `'unsafe-inline'` from `style-src`

`style-src` no longer uses `'unsafe-inline'`. Three categories of inline styles
are covered:

1. **`style={{}}` JSX attributes** (decorative petal animations) were refactored
   to CSS classes. Nineteen petal animation spans (7 in `Navbar.tsx`, 7 in
   `Footer.tsx`, 5 in `not-found.tsx`) had their per-instance `left`, `top`,
   `animation-duration`, and `animation-delay` values moved into named CSS
   classes (`.petal-nav-1`–`7`, `.petal-foot-1`–`7`, `.petal-404-1`–`5`) in
   `globals.css`. No visual values changed.

2. **Framework `<style>` blocks** (e.g. `_global-error.html` error-page CSS) are
   hashed by the post-build script and allowed via `'sha256-...'` in `style-src`.

3. **Framework `style="..."` attributes** (e.g. `next/image` fill positioning,
   error-page button/layout styles) are hashed by the post-build script. The
   script extracts each `style="..."` value, decodes HTML entities (attribute
   values ARE entity-decoded by the HTML parser, unlike `<script>`/`<style>`
   content), and computes a sha256 hash. These hashes are added to `style-src`
   alongside any `<style>`-block hashes.

Pages without any of the above get `style-src 'self'` (no hashes, no
`'unsafe-inline'`). All animation behavior is preserved, including the
`prefers-reduced-motion` guard.

## Production/preview scoping

`vercel.live` (the Vercel Live preview/collaboration toolbar) requires access
to `script-src`, `connect-src` (WebSocket), and `frame-src`. To prevent a
compromised `vercel.live` origin from executing code in the production origin,
these sources are only added when `VERCEL_ENV !== "production"`. This mirrors
the existing logic that was in `next.config.ts`, now moved to the post-build
script.

## How to add new routes

No configuration needed. The post-build script walks all `*.html` files in
`.next/server/app/` recursively. Any new statically-generated route will be
automatically picked up on the next build.

## How to add new CDN script sources

Edit the `CSP_DIRECTIVES` array in `scripts/inject-csp-hashes.ts`. For example,
to allow scripts from `https://cdn.example.com`:

```typescript
`script-src 'self' {HASHES} https://js.stripe.com https://cdn.example.com${...}`
```

## Verification

1. **Build output**: Run `bun run build` and check that the post-build script
   prints a summary of hashes per route.
2. **HTML inspection**: Open `.next/server/app/index.html` and verify:
   - The `<meta http-equiv="Content-Security-Policy">` tag is present in `<head>`.
   - `script-src` contains `'sha256-...'` entries (no `'unsafe-inline'`).
   - `style-src` contains no `'unsafe-inline'`. Pages with `next/image` (index, flowers, bouquets) have `'sha256-...'` entries for the fill positioning style. `_global-error.html` has hashes for both its `<style>` block and its `style="..."` attrs (including the entity-decoded font-family). Other pages have bare `style-src 'self'`.
   - `frame-ancestors` is absent from the meta tag.
   - Zero `style="..."` attributes appear on user-facing petals in the built HTML.
3. **Browser DevTools**: Deploy to a preview deployment, open the page, and
   check the Console for CSP violation reports. The Security tab shows the
   effective CSP. All page functionality (navigation, cart, checkout) should
   work without script-related CSP violations.
4. **Production verification**: Deploy to production and repeat the same checks.
   In production, `vercel.live` sources should be absent from the CSP.

## Upstream tracking

The Next.js team is working on native build-time CSP hash injection and SRI
support for inline scripts. When those features ship (expected in a future
version), this roll-your-own approach can be replaced by enabling the relevant
configuration flag in `next.config.ts`. Monitor the Next.js releases for
mentions of "CSP hash" or "inline script integrity" in the changelog.

## Threat model

**What this protects against:**

- **XSS with inline script injection**: If an attacker finds a way to inject a
  `<script>` tag (e.g. via a stored XSS in a CMS field or a DOM-based XSS in a
  third-party widget), the injected script's content will not match any allowed
  hash, so the browser blocks it.
- **CDN compromise**: If a third-party CDN serving one of the external scripts
  is compromised, the compromised script *could* still execute (it matches
  `https://js.stripe.com` in `script-src`). However, inline script injection
  via that compromised script is blocked because the injected inline scripts
  would not match allowed hashes. Hash-based CSP is defense in depth, not a
  silver bullet.

**What it does NOT protect against:**

- **Compromise of the build pipeline**: An attacker who can modify the build
  output can inject both the inline script AND its hash into the CSP. The
  post-build script runs as part of the build — if the build is compromised,
  the CSP is compromised too. Protect the build pipeline via standard supply
  chain security practices (locked dependencies, CI/CD access controls,
  signed commits).
- **External script compromise**: External scripts (loaded via `src`) are still
  allowed by origin (`https://js.stripe.com`). A compromised Stripe CDN could
  still execute arbitrary JavaScript. `'strict-dynamic'` or nonce-based CSP
  could further restrict this, but would require non-static delivery.
- **Data exfiltration via allowed CSS**: Inline `style` attributes and
  `<style>` blocks are now hash-gated (no `'unsafe-inline'`), so CSS-based
  data exfiltration via injected inline styles (e.g. attribute selectors with
  external URLs) is blocked. External stylesheets loaded via `<link>` remain
  allowed by origin, and hashed `<style>` blocks are allowed. Hash-gating
  inline styles is a meaningful improvement over `'unsafe-inline'` for CSS
  injection attacks.
