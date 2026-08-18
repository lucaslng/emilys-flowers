// src/app/api/admin/callback/route.ts
//
// OIDC redirect target. Verifies the `state` returned by the provider against
// the `oidc_state` cookie, exchanges the authorization code for tokens (with
// the PKCE verifier), validates the ID token, checks group membership, and
// issues the `admin_session` JWT cookie. Failures redirect to
// `/admin/orders?error=...` with the OIDC cookies cleared.

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import {
  createSessionToken,
  exchangeCodeForTokens,
  fetchUserInfo,
  getOidcConfig,
  getOidcDiscovery,
  isAllowedByGroups,
  isOidcConfigured,
  resolveRedirectUri,
  verifyIdToken,
  OIDC_STATE_COOKIE,
  OIDC_VERIFIER_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/admin-auth';

/** Constant-time state comparison (lengths must match). */
function statesMatch(submitted: string, expected: string): boolean {
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const redirectUri = resolveRedirectUri(request.url);

  if (!isOidcConfigured()) {
    return NextResponse.json(
      { error: 'OIDC admin auth is not configured on the server.' },
      { status: 500 }
    );
  }

  const config = getOidcConfig(redirectUri);

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = request.cookies.get(OIDC_STATE_COOKIE)?.value;
  const verifier = request.cookies.get(OIDC_VERIFIER_COOKIE)?.value;

  const failRedirect = (error: 'signin' | 'forbidden') => {
    const response = NextResponse.redirect(
      new URL(`/admin/orders?error=${error}`, request.url).toString()
    );
    response.cookies.delete({ name: OIDC_STATE_COOKIE, path: '/' });
    response.cookies.delete({ name: OIDC_VERIFIER_COOKIE, path: '/' });
    return response;
  };

  if (!code || !state || !cookieState || !verifier || !statesMatch(state, cookieState)) {
    return failRedirect('signin');
  }

  let claims: Record<string, unknown>;
  try {
    const discovery = await getOidcDiscovery(config.issuer);
    const { idToken, accessToken } = await exchangeCodeForTokens(
      config,
      discovery,
      code,
      verifier
    );
    const idClaims = await verifyIdToken(config, discovery, idToken);
    const userInfo = await fetchUserInfo(discovery, accessToken);
    claims = { ...userInfo, ...idClaims }; // ID token wins.

    if (!isAllowedByGroups(claims, config.allowedGroups)) {
      return failRedirect('forbidden');
    }
  } catch (error) {
    console.error('[Admin OIDC callback] Error:', error);
    return failRedirect('signin');
  }

  const token = await createSessionToken(config, claims);
  const response = NextResponse.redirect(
    new URL('/admin/orders', request.url).toString()
  );
  response.cookies.delete({ name: OIDC_STATE_COOKIE, path: '/' });
  response.cookies.delete({ name: OIDC_VERIFIER_COOKIE, path: '/' });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
