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
  resolveRedirectUri,
  OIDC_STATE_COOKIE,
  OIDC_STATE_MAX_AGE_SECONDS,
  OIDC_VERIFIER_COOKIE,
} from '@/lib/admin-auth';

export async function GET(request: Request) {
  const redirectUri = resolveRedirectUri(request.url);

  if (!isOidcConfigured()) {
    return NextResponse.json(
      { error: 'OIDC admin auth is not configured on the server.' },
      { status: 500 }
    );
  }

  const config = getOidcConfig(redirectUri);
  const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const { verifier, challenge } = await generatePkcePair();

  const discovery = await getOidcDiscovery(config.issuer);
  const authorizeUrl = buildAuthorizeUrl(config, discovery, state, challenge);

  const response = NextResponse.redirect(authorizeUrl);
  const oidcCookieOptions = {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: OIDC_STATE_MAX_AGE_SECONDS,
  };
  response.cookies.set(OIDC_STATE_COOKIE, state, oidcCookieOptions);
  response.cookies.set(OIDC_VERIFIER_COOKIE, verifier, oidcCookieOptions);
  return response;
}
