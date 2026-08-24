// src/app/api/admin/login/route.ts
//
// Admin sign-in (OIDC). Redirects to the provider's authorize endpoint with a
// PKCE challenge and a random `state`, stashing the verifier + state in
// short-lived httpOnly cookies for the callback route to verify.

import { NextResponse } from 'next/server';
import {
  base64url,
  buildAuthorizeUrl,
  generatePkcePair,
  getOidcConfig,
  getOidcDiscovery,
  isOidcConfigured,
  oidcNotConfiguredResponse,
  resolveRedirectUri,
  sessionCookieOptions,
  OIDC_STATE_COOKIE,
  OIDC_STATE_MAX_AGE_SECONDS,
  OIDC_VERIFIER_COOKIE,
} from '@/lib/admin-auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const redirectUri = resolveRedirectUri(request.url);

  if (!isOidcConfigured()) {
    return oidcNotConfiguredResponse();
  }

  // Bounds unauthenticated authorize-redirect minting. Discovery is cached
  // 1h per isolate, but cold-start floods would otherwise fan out to the
  // IdP (issue #217).
  const rateLimited = await checkRateLimit(request, 'admin-login');
  if (rateLimited) {
    return rateLimited;
  }

  const config = getOidcConfig(redirectUri);
  const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const { verifier, challenge } = await generatePkcePair();

  const discovery = await getOidcDiscovery(config.issuer);
  const authorizeUrl = buildAuthorizeUrl(config, discovery, state, challenge);

  const response = NextResponse.redirect(authorizeUrl);
  const oidcCookieOptions = sessionCookieOptions(OIDC_STATE_MAX_AGE_SECONDS);
  response.cookies.set(OIDC_STATE_COOKIE, state, oidcCookieOptions);
  response.cookies.set(OIDC_VERIFIER_COOKIE, verifier, oidcCookieOptions);
  return response;
}
