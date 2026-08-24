// Server-only OIDC admin auth + HS256 session cookie; Web Crypto + jose only — no Node-only APIs (Cloudflare Workers).

import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { NextResponse } from 'next/server';
import { resolveBaseOrigin } from '@/lib/base-url';

export const SESSION_COOKIE = '__Host-admin_session';
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

export function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function hasValidSessionSecret(): boolean {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return typeof secret === 'string' && secret.length >= 32;
}

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
  // Fail closed in production: never derive the base URL from a client-supplied Host header.
  if (process.env.NODE_ENV === 'production' && !process.env.BASE_URL) {
    missing.push('BASE_URL');
  }
  return missing;
}

export function isOidcConfigured(): boolean {
  return missingRequiredEnvVars().length === 0 && hasValidSessionSecret();
}

/** Empty/unset ADMIN_OIDC_GROUPS yields an empty allowlist, which fails closed downstream. */
function getAllowedGroupsFromEnv(): string[] {
  return (process.env.ADMIN_OIDC_GROUPS ?? '')
    .split(',')
    .map((group) => group.trim())
    .filter(Boolean);
}

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
  return `${resolveBaseOrigin(requestUrl)}/api/admin/callback`;
}

const discoveryCache = new Map<string, { at: number; data: OidcDiscovery }>();

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

const jwksCache = new Map<
  string,
  ReturnType<typeof createRemoteJWKSet>
>();

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

/** Returns null on any failure; re-checks groups against the CURRENT allowlist so allowlist edits revoke sessions before their 8h TTL. */
export async function verifySessionToken(
  token: string | undefined
): Promise<SessionClaims | null> {
  if (!token) return null;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET is not configured on the server.');
  }
  // A short secret is forgeable offline — treat as an invalid session rather than trusting its signature.
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

export function oidcNotConfiguredResponse(): NextResponse {
  return NextResponse.json(
    { error: 'OIDC admin auth is not configured on the server.' },
    { status: 500 }
  );
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    // The __Host- prefix requires Secure on every response, dev included.
    secure: true,
    maxAge: maxAgeSeconds,
  };
}

export function clearOidcCookies(response: NextResponse): void {
  response.cookies.delete({ name: OIDC_STATE_COOKIE, path: '/' });
  response.cookies.delete({ name: OIDC_VERIFIER_COOKIE, path: '/' });
}