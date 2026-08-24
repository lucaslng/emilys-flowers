/**
 * Server-side origin for redirect URLs we hand to third parties (Stripe
 * success/cancel URLs, the OIDC callback): `BASE_URL` when set, else the
 * request origin (dev fallback). Trailing slashes are trimmed.
 */
export function resolveBaseOrigin(requestUrl: string): string {
  // `||` (not `??`) so an empty-string BASE_URL falls back like an unset one.
  return (process.env.BASE_URL || new URL(requestUrl).origin).replace(
    /\/+$/,
    ''
  );
}

/**
 * Fail closed in production: a Host-derived origin is client-supplied and
 * spoofable, so redirect origins must come from `BASE_URL` there (mirrors
 * the admin OIDC requirement).
 */
export function isBaseUrlConfigured(): boolean {
  return process.env.NODE_ENV !== 'production' || Boolean(process.env.BASE_URL);
}
