/** Origin for third-party redirect URLs (Stripe, OIDC): `BASE_URL` when set, else the request origin; trailing slashes trimmed. */
export function resolveBaseOrigin(requestUrl: string): string {
  // `||` (not `??`) so an empty-string BASE_URL falls back like an unset one.
  return (process.env.BASE_URL || new URL(requestUrl).origin).replace(
    /\/+$/,
    ''
  );
}

/** Fail closed in production — Host-derived origins are client-supplied and spoofable, mirroring the admin OIDC requirement. */
export function isBaseUrlConfigured(): boolean {
  return process.env.NODE_ENV !== 'production' || Boolean(process.env.BASE_URL);
}
