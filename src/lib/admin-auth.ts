// Server-only OIDC admin authentication + session helpers (login redirect,
// callback token exchange, HS256 session JWT in the `admin_session` cookie).
// Web Crypto + `jose` only — no Node-only APIs (runs on Cloudflare Workers
// via OpenNext).

import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'admin_session';
export const SESSION_MAX_AGE_SECONDS = 28800; // 8h
export const OIDC_STATE_COOKIE = 'oidc_state';
export const OIDC_VERIFIER_COOKIE = 'oidc_verifier';
export const OIDC_STATE_MAX_AGE_SECONDS = 600; // 10 min

const REQUIRED_ENV_VARS = [
  'OIDC_ISSUER',
  'OIDC_CLIENT_ID',
  'OIDC_CLIENT_SECRET',
  'ADMIN_SESSION_SECRET',
  'ADMIN_OIDC_GROUPS',
] as const;

const DISCOVERY_TTL_MS = 60 * 60 * 1000; // 1h

const OIDC_FETCH_TIMEOUT_MS = 10_000;

/** fetch with a hard 10s abort so a hung IdP can't hold requests open. */
async function fetchWithTimeout(
  input: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, {
    ...init,
    signal: AbortSignal.timeout(OIDC_FETCH_TIMEOUT_MS),
  });
}

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  allowedGroups: string[];
  sessionSecret: string;
}

export interface OidcDiscovery {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  userinfoEndpoint?: string;
  issuer: string;
  idTokenSigningAlgs?: string[];
}

export interface SessionClaims {
  sub: string;
  email?: string;
  groups?: string[] | string;
}

/** base64url-encode bytes (RFC 4648 §5): no padding, URL-safe alphabet. */
export function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** True when the session secret is set and strong enough to sign admin sessions. */
function hasValidSessionSecret(): boolean {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return typeof secret === 'string' && secret.length >= 32;
}

/** Throws unless the session secret is strong enough to sign admin sessions. */
function assertValidSessionSecret(secret: string): void {
  if (secret.length < 32) {
    throw new Error(
      'OIDC admin auth is not configured: ADMIN_SESSION_SECRET must be at least 32 characters'
    );
  }
}

function missingRequiredEnvVars(): string[] {
  const missing: string[] = REQUIRED_ENV_VARS.filter(
    (name) => !process.env[name]
  );
  // Fail closed in production: the base URL must never be derived from a
  // client-supplied Host header, so it is required there.
  if (process.env.NODE_ENV === 'production' && !process.env.BASE_URL) {
    missing.push('BASE_URL');
  }
  return missing;
}

/** True when all required OIDC env vars are set and the session secret is strong. */
export function isOidcConfigured(): boolean {
  return missingRequiredEnvVars().length === 0 && hasValidSessionSecret();
}

/**
 * Parses `ADMIN_OIDC_GROUPS` (comma-separated) into the current allowlist;
 * an empty/unset value yields an empty list, which fails closed downstream.
 */
function getAllowedGroupsFromEnv(): string[] {
  return (process.env.ADMIN_OIDC_GROUPS ?? '')
    .split(',')
    .map((group) => group.trim())
    .filter(Boolean);
}

/**
 * Returns the OIDC config, throwing an Error that names exactly which
 * required env vars are missing.
 */
export function getOidcConfig(redirectUri: string): OidcConfig {
  const missing = missingRequiredEnvVars();
  if (missing.length > 0) {
    throw new Error(
      `OIDC admin auth is not configured: missing ${missing.join(', ')}`
    );
  }
  assertValidSessionSecret(process.env.ADMIN_SESSION_SECRET!);
  return {
    issuer: process.env.OIDC_ISSUER!,
    clientId: process.env.OIDC_CLIENT_ID!,
    clientSecret: process.env.OIDC_CLIENT_SECRET!,
    redirectUri,
    allowedGroups: getAllowedGroupsFromEnv(),
    sessionSecret: process.env.ADMIN_SESSION_SECRET!,
  };
}

/** Callback URL: `BASE_URL` + /api/admin/callback, else request origin + the path. */
export function resolveRedirectUri(requestUrl: string): string {
  const base = (process.env.BASE_URL ?? new URL(requestUrl).origin).replace(
    /\/+$/,
    ''
  );
  return `${base}/api/admin/callback`;
}

// Module-level discovery cache: `{ at, data }`, refetched after 1h.
const discoveryCache = new Map<string, { at: number; data: OidcDiscovery }>();

/** Fetches (and caches for 1h) the provider's OpenID configuration. */
export async function getOidcDiscovery(
  issuer: string
): Promise<OidcDiscovery> {
  const base = issuer.replace(/\/+$/, '');
  const cached = discoveryCache.get(base);
  if (cached && Date.now() - cached.at < DISCOVERY_TTL_MS) {
    return cached.data;
  }

  const response = await fetchWithTimeout(
    `${base}/.well-known/openid-configuration`
  );
  if (!response.ok) {
    throw new Error(
      `OIDC discovery request failed with status ${response.status}`
    );
  }
  const doc = (await response.json()) as Record<string, unknown>;
  const rawAlgs = doc.id_token_signing_alg_values_supported;
  const data: OidcDiscovery = {
    authorizationEndpoint: String(doc.authorization_endpoint ?? ''),
    tokenEndpoint: String(doc.token_endpoint ?? ''),
    jwksUri: String(doc.jwks_uri ?? ''),
    userinfoEndpoint: doc.userinfo_endpoint
      ? String(doc.userinfo_endpoint)
      : undefined,
    issuer: String(doc.issuer ?? base),
    idTokenSigningAlgs: Array.isArray(rawAlgs)
      ? rawAlgs.map((alg) => String(alg))
      : undefined,
  };
  discoveryCache.set(base, { at: Date.now(), data });
  return data;
}

/** PKCE pair: 32 random bytes → base64url verifier; SHA-256(verifier) → challenge. */
export async function generatePkcePair(): Promise<{
  verifier: string;
  challenge: string;
}> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

/** Builds the provider authorize URL with PKCE + state params. */
export function buildAuthorizeUrl(
  config: OidcConfig,
  discovery: OidcDiscovery,
  state: string,
  codeChallenge: string
): string {
  const url = new URL(discovery.authorizationEndpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('scope', 'openid email profile groups');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

/** Exchanges the authorization code for an ID token (+ optional access token). */
export async function exchangeCodeForTokens(
  config: OidcConfig,
  discovery: OidcDiscovery,
  code: string,
  codeVerifier: string
): Promise<{ idToken: string; accessToken?: string }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: codeVerifier,
  });
  const response = await fetchWithTimeout(discovery.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    throw new Error(`Token exchange failed with status ${response.status}`);
  }
  const data = (await response.json()) as Record<string, unknown>;
  if (data.error) {
    throw new Error(`Token exchange failed: ${String(data.error)}`);
  }
  if (typeof data.id_token !== 'string') {
    throw new Error('Token exchange failed: id_token missing from response');
  }
  return {
    idToken: data.id_token,
    accessToken:
      typeof data.access_token === 'string' ? data.access_token : undefined,
  };
}

// Module-level JWKS cache: one remote key set per JWKS URI, reused across
// verifications instead of rebuilding (and re-fetching) on every call.
const jwksCache = new Map<
  string,
  ReturnType<typeof createRemoteJWKSet>
>();

/** Verifies the ID token signature/issuer/audience against the provider JWKS. */
export async function verifyIdToken(
  config: OidcConfig,
  discovery: OidcDiscovery,
  idToken: string
): Promise<Record<string, unknown>> {
  let jwks = jwksCache.get(discovery.jwksUri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(discovery.jwksUri));
    jwksCache.set(discovery.jwksUri, jwks);
  }
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: discovery.issuer,
    audience: config.clientId,
    algorithms:
      discovery.idTokenSigningAlgs && discovery.idTokenSigningAlgs.length > 0
        ? discovery.idTokenSigningAlgs
        : ['RS256', 'ES256'],
  });
  return payload as Record<string, unknown>;
}

/** Fetches userinfo claims; `{}` when the provider has no endpoint or no token. */
export async function fetchUserInfo(
  discovery: OidcDiscovery,
  accessToken?: string
): Promise<Record<string, unknown>> {
  if (!discovery.userinfoEndpoint || !accessToken) return {};
  const response = await fetchWithTimeout(discovery.userinfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return {};
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** True when the claims' `groups` (string or string[]) intersects allowedGroups. */
export function isAllowedByGroups(
  claims: Record<string, unknown>,
  allowedGroups: string[]
): boolean {
  if (allowedGroups.length === 0) return false;
  const groups = claims.groups;
  const userGroups: string[] =
    typeof groups === 'string'
      ? [groups]
      : Array.isArray(groups)
        ? groups.filter((group): group is string => typeof group === 'string')
        : [];
  return userGroups.some((group) => allowedGroups.includes(group));
}

/** Signs an 8h HS256 session JWT from the verified OIDC claims. */
export async function createSessionToken(
  config: OidcConfig,
  claims: Record<string, unknown>
): Promise<string> {
  return new SignJWT({
    sub: typeof claims.sub === 'string' ? claims.sub : undefined,
    email: claims.email,
    groups: claims.groups,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(new TextEncoder().encode(config.sessionSecret));
}

/**
 * Verifies the `admin_session` JWT against `ADMIN_SESSION_SECRET` and
 * re-checks its `groups` claim against the CURRENT `ADMIN_OIDC_GROUPS`
 * allowlist, so allowlist changes revoke existing sessions before the 8h
 * TTL expires (the claim is baked in at login). Fails closed when the
 * allowlist is unset/empty. Returns `null` on any failure
 * (missing/malformed/expired/bad signature/no longer in an allowed group).
 */
export async function verifySessionToken(
  token: string | undefined
): Promise<SessionClaims | null> {
  if (!token) return null;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET is not configured on the server.');
  }
  // Fail closed on the verify path too: a short secret is forgeable offline,
  // so treat it as an invalid session rather than trusting its signature.
  if (secret.length < 32) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    if (typeof payload.sub !== 'string') return null;
    if (
      !isAllowedByGroups(
        payload as Record<string, unknown>,
        getAllowedGroupsFromEnv()
      )
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      groups:
        typeof payload.groups === 'string' || Array.isArray(payload.groups)
          ? payload.groups
          : undefined,
    };
  } catch {
    return null;
  }
}

/** The shared 500 JSON body used by the OIDC routes when env config is absent. */
export function oidcNotConfiguredResponse(): NextResponse {
  return NextResponse.json(
    { error: 'OIDC admin auth is not configured on the server.' },
    { status: 500 }
  );
}

/** Cookie attributes shared by every admin/OIDC cookie this module issues. */
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAgeSeconds,
  };
}

/** Clears the transient OIDC state + PKCE verifier cookies on any response. */
export function clearOidcCookies(response: NextResponse): void {
  response.cookies.delete({ name: OIDC_STATE_COOKIE, path: '/' });
  response.cookies.delete({ name: OIDC_VERIFIER_COOKIE, path: '/' });
}