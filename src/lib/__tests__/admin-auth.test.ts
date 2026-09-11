import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { unsetEnv } from './env-helpers';
import { SignJWT } from 'jose';
import { NextResponse } from 'next/server';
import {
  buildAuthorizeUrl,
  clearOidcCookies,
  createSessionToken,
  exchangeCodeForTokens,
  fetchUserInfo,
  generatePkcePair,
  getOidcConfig,
  getOidcDiscovery,
  isOidcConfigured,
  oidcNotConfiguredResponse,
  resolveRedirectUri,
  sessionCookieOptions,
  verifySessionToken,
  OIDC_STATE_COOKIE,
  OIDC_VERIFIER_COOKIE,
  type OidcConfig,
} from '@/lib/admin-auth';

const REQUIRED_VARS = [
  'OIDC_ISSUER',
  'OIDC_CLIENT_ID',
  'OIDC_CLIENT_SECRET',
  'ADMIN_SESSION_SECRET',
];

const BASE_URL = 'https://shop.example.com';
const CALLBACK_URL = `${BASE_URL}/api/admin/callback`;

function setAllEnv() {
  process.env.OIDC_ISSUER = 'https://accounts.example.com';
  process.env.OIDC_CLIENT_ID = 'client-123';
  process.env.OIDC_CLIENT_SECRET = 'client-secret';
  process.env.ADMIN_SESSION_SECRET =
    'a-very-long-admin-session-secret-for-hs256-signing';
  process.env.BASE_URL = BASE_URL;
}

function clearAllEnv() {
  for (const name of REQUIRED_VARS) unsetEnv(name);
  unsetEnv("BASE_URL");
}

beforeEach(() => {
  clearAllEnv();
  setAllEnv();
});

afterEach(() => {
  clearAllEnv();
});

function base64urlRecompute(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

describe('isOidcConfigured', () => {
  test('is true when all required env vars are set', () => {
    expect(isOidcConfigured()).toBe(true);
  });

  test('is false when a required env var is missing', () => {
    unsetEnv("OIDC_CLIENT_SECRET");
    expect(isOidcConfigured()).toBe(false);
  });

  test('is false when ADMIN_SESSION_SECRET is shorter than 32 characters', () => {
    process.env.ADMIN_SESSION_SECRET = 'short-secret';
    expect(isOidcConfigured()).toBe(false);
  });

  test('requires BASE_URL when NODE_ENV is production', () => {
    // `NODE_ENV` is declared read-only on ProcessEnv; cast to mutate it.
    const env = process.env as Record<string, string | undefined>;
    const originalNodeEnv = env.NODE_ENV;
    try {
      delete env.BASE_URL;
      env.NODE_ENV = 'production';

      expect(isOidcConfigured()).toBe(false);
      expect(() => getOidcConfig(CALLBACK_URL)).toThrow(
        'OIDC admin auth is not configured: missing BASE_URL'
      );
    } finally {
      if (originalNodeEnv === undefined) {
        delete env.NODE_ENV;
      } else {
        env.NODE_ENV = originalNodeEnv;
      }
    }
  });
});

describe('getOidcConfig', () => {
  test('throws naming exactly the missing required env vars', () => {
    unsetEnv("OIDC_ISSUER");
    unsetEnv("ADMIN_SESSION_SECRET");
    expect(() => getOidcConfig(CALLBACK_URL)).toThrow(
      'OIDC admin auth is not configured: missing OIDC_ISSUER, ADMIN_SESSION_SECRET'
    );
  });

  test('returns the expected config shape', () => {
    const config = getOidcConfig(CALLBACK_URL);
    expect(config).toEqual({
      issuer: 'https://accounts.example.com',
      clientId: 'client-123',
      clientSecret: 'client-secret',
      redirectUri: CALLBACK_URL,
      sessionSecret: 'a-very-long-admin-session-secret-for-hs256-signing',
    });
  });

  test('throws when ADMIN_SESSION_SECRET is shorter than 32 characters', () => {
    process.env.ADMIN_SESSION_SECRET = 'short-secret';
    expect(() => getOidcConfig(CALLBACK_URL)).toThrow(
      'OIDC admin auth is not configured: ADMIN_SESSION_SECRET must be at least 32 characters'
    );
  });
});

describe('resolveRedirectUri', () => {
  test('trims a trailing slash from BASE_URL before appending /api/admin/callback', () => {
    process.env.BASE_URL = 'https://example.com/';
    expect(resolveRedirectUri('https://shop.example.com/whatever')).toBe(
      'https://example.com/api/admin/callback'
    );
  });
});

describe('generatePkcePair', () => {
  test('returns base64url verifier and challenge, challenge = base64url(SHA-256(verifier))', async () => {
    const { verifier, challenge } = await generatePkcePair();

    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifier).not.toContain('=');
    expect(challenge).not.toContain('=');

    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(verifier)
    );
    expect(challenge).toBe(base64urlRecompute(new Uint8Array(digest)));
  });
});

describe('buildAuthorizeUrl', () => {
  test('includes the expected OIDC authorization params', () => {
    const config: OidcConfig = {
      issuer: 'https://accounts.example.com',
      clientId: 'client-123',
      clientSecret: 'client-secret',
      redirectUri: CALLBACK_URL,
      sessionSecret: 'a-very-long-admin-session-secret-for-hs256-signing',
    };
    const discovery = {
      authorizationEndpoint: 'https://accounts.example.com/authorize',
      tokenEndpoint: 'https://accounts.example.com/token',
      jwksUri: 'https://accounts.example.com/jwks',
      issuer: 'https://accounts.example.com',
    };

    const url = buildAuthorizeUrl(config, discovery, 'state-123', 'challenge-abc');
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe(
      'https://accounts.example.com/authorize'
    );
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe('client-123');
    expect(parsed.searchParams.get('redirect_uri')).toBe(CALLBACK_URL);
    expect(parsed.searchParams.get('scope')).toBe('openid email profile');
    expect(parsed.searchParams.get('state')).toBe('state-123');
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge-abc');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
  });
});

describe('createSessionToken / verifySessionToken', () => {
  test('roundtrips sub and email', async () => {
    const config = getOidcConfig(CALLBACK_URL);
    const token = await createSessionToken(config, {
      sub: 'user-42',
      email: 'owner@example.com',
    });

    expect(await verifySessionToken(token)).toEqual({
      sub: 'user-42',
      email: 'owner@example.com',
    });
  });

  test('returns null for a missing token', async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
  });

  test('returns null for a tampered token', async () => {
    const config = getOidcConfig(CALLBACK_URL);
    const token = await createSessionToken(config, { sub: 'user-42' });
    const tampered = token.slice(0, -3) + 'abc';

    expect(await verifySessionToken(tampered)).toBeNull();
  });

  test('returns null for a token signed with a different secret', async () => {
    const otherSecret = 'a-different-admin-session-secret-that-is-long-enough';
    const token = await new SignJWT({ sub: 'user-42' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(new TextEncoder().encode(otherSecret));

    expect(await verifySessionToken(token)).toBeNull();
  });

  test('returns null for an expired token', async () => {
    const config = getOidcConfig(CALLBACK_URL);
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ sub: 'user-42' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now - 7200)
      .setExpirationTime(now - 3600)
      .sign(new TextEncoder().encode(config.sessionSecret));

    expect(await verifySessionToken(token)).toBeNull();
  });

  test('returns null when ADMIN_SESSION_SECRET is shorter than 32 characters', async () => {
    process.env.ADMIN_SESSION_SECRET = 'short-secret';
    const token = await new SignJWT({ sub: 'user-42' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(new TextEncoder().encode('short-secret'));

    expect(await verifySessionToken(token)).toBeNull();
  });

  test('returns null when the token has no sub claim', async () => {
    const config = getOidcConfig(CALLBACK_URL);
    const token = await new SignJWT({ email: 'owner@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(new TextEncoder().encode(config.sessionSecret));

    expect(await verifySessionToken(token)).toBeNull();
  });

  test('accepts a token without an email claim', async () => {
    const config = getOidcConfig(CALLBACK_URL);
    const token = await new SignJWT({ sub: 'user-42' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(new TextEncoder().encode(config.sessionSecret));

    expect(await verifySessionToken(token)).toEqual({
      sub: 'user-42',
      email: undefined,
    });
  });
});

describe('exchangeCodeForTokens', () => {
  test('throws on a non-ok response', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: false,
      status: 502,
    })) as unknown as typeof fetch;
    try {
      const config = getOidcConfig(CALLBACK_URL);
      const discovery = {
        authorizationEndpoint: 'https://accounts.example.com/authorize',
        tokenEndpoint: 'https://accounts.example.com/token',
        jwksUri: 'https://accounts.example.com/jwks',
        issuer: 'https://accounts.example.com',
      };
      await expect(
        exchangeCodeForTokens(config, discovery, 'code-123', 'verifier-123')
      ).rejects.toThrow('Token exchange failed with status 502');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('fetchUserInfo', () => {
  test('returns {} on a non-ok response', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: false,
      status: 500,
    })) as unknown as typeof fetch;
    try {
      const discovery = {
        authorizationEndpoint: 'https://accounts.example.com/authorize',
        tokenEndpoint: 'https://accounts.example.com/token',
        jwksUri: 'https://accounts.example.com/jwks',
        userinfoEndpoint: 'https://accounts.example.com/userinfo',
        issuer: 'https://accounts.example.com',
      };
      expect(await fetchUserInfo(discovery, 'access-token')).toEqual({});
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('sessionCookieOptions', () => {
  test('carries the exact cookie attributes issued to browsers', () => {
    expect(sessionCookieOptions(28800)).toEqual({
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: true,
      maxAge: 28800,
    });
  });
});

describe('oidcNotConfiguredResponse', () => {
  test('returns the shared 500 JSON body', async () => {
    const response = oidcNotConfiguredResponse();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'OIDC admin auth is not configured on the server.',
    });
  });
});

describe('clearOidcCookies', () => {
  test('deletes both the state and verifier cookies on the response', () => {
    const response = new NextResponse();
    response.cookies.set(OIDC_STATE_COOKIE, 'state-123');
    response.cookies.set(OIDC_VERIFIER_COOKIE, 'verifier-123');

    clearOidcCookies(response);

    // `cookies.delete` expires the cookie (empty value, epoch expiry) rather than removing it from the map.
    expect(response.cookies.get(OIDC_STATE_COOKIE)?.value).toBe('');
    expect(response.cookies.get(OIDC_VERIFIER_COOKIE)?.value).toBe('');
  });
});

describe('outbound IdP fetches', () => {
  function stubFetchCapturingInit(): {
    calls: Array<{ input: string; init: RequestInit | undefined }>;
    restore: () => void;
  } {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ input: string; init: RequestInit | undefined }> = [];
    globalThis.fetch = (async (
      input: string,
      init?: RequestInit
    ) => {
      calls.push({ input, init });
      return { ok: true, json: async () => ({}) };
    }) as unknown as typeof fetch;
    return { calls, restore: () => (globalThis.fetch = originalFetch) };
  }

  test('discovery requests carry an abort signal (10s timeout)', async () => {
    unsetEnv("OIDC_ISSUER");
    const { calls, restore } = stubFetchCapturingInit();
    try {
      await getOidcDiscovery('https://timeout-check.example.com');
      expect(calls).toHaveLength(1);
      expect(calls[0].input).toBe(
        'https://timeout-check.example.com/.well-known/openid-configuration'
      );
      expect(calls[0].init?.signal).toBeInstanceOf(AbortSignal);
      expect((calls[0].init?.signal as AbortSignal).aborted).toBe(false);
    } finally {
      restore();
    }
  });

  test('token-exchange requests carry an abort signal (10s timeout)', async () => {
    const { calls, restore } = stubFetchCapturingInit();
    try {
      const config = getOidcConfig(CALLBACK_URL);
      const discovery = {
        authorizationEndpoint: 'https://accounts.example.com/authorize',
        tokenEndpoint: 'https://accounts.example.com/token',
        jwksUri: 'https://accounts.example.com/jwks',
        issuer: 'https://accounts.example.com',
      };
      // The stub returns `{}` with no id_token → the exchange throws after the fetch, proving the timeout path ran.
      await expect(
        exchangeCodeForTokens(config, discovery, 'code-123', 'verifier-123')
      ).rejects.toThrow('id_token missing from response');
      expect(calls).toHaveLength(1);
      expect(calls[0].input).toBe('https://accounts.example.com/token');
      expect(calls[0].init?.signal).toBeInstanceOf(AbortSignal);
    } finally {
      restore();
    }
  });
});

describe('discovery issuer cross-check', () => {
  function stubDiscoveryDoc(doc: Record<string, unknown>): {
    calls: () => number;
    restore: () => void;
  } {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return { ok: true, json: async () => doc };
    }) as unknown as typeof fetch;
    return { calls: () => calls, restore: () => (globalThis.fetch = originalFetch) };
  }

  test('fails closed on an issuer mismatch and does not cache the rejected document', async () => {
    const stub = stubDiscoveryDoc({
      issuer: 'https://evil.example.com',
      authorization_endpoint: 'https://evil.example.com/authorize',
      token_endpoint: 'https://evil.example.com/token',
      jwks_uri: 'https://evil.example.com/jwks',
    });
    try {
      await expect(
        getOidcDiscovery('https://issuer-mismatch.example.com')
      ).rejects.toThrow(/mismatch/i);
      await expect(
        getOidcDiscovery('https://issuer-mismatch.example.com')
      ).rejects.toThrow(/mismatch/i);
      expect(stub.calls()).toBe(2);
    } finally {
      stub.restore();
    }
  });

  test('succeeds when the discovery issuer matches OIDC_ISSUER exactly', async () => {
    const stub = stubDiscoveryDoc({
      issuer: 'https://accounts.example.com',
      authorization_endpoint: 'https://accounts.example.com/authorize',
      token_endpoint: 'https://accounts.example.com/token',
      jwks_uri: 'https://accounts.example.com/jwks',
    });
    try {
      const discovery = await getOidcDiscovery(
        'https://issuer-match.example.com'
      );
      expect(discovery.issuer).toBe('https://accounts.example.com');
    } finally {
      stub.restore();
    }
  });

  test('skips the cross-check when OIDC_ISSUER is unset', async () => {
    unsetEnv("OIDC_ISSUER");
    const stub = stubDiscoveryDoc({
      issuer: 'https://someone-else.example.com',
      authorization_endpoint: 'https://someone-else.example.com/authorize',
      token_endpoint: 'https://someone-else.example.com/token',
      jwks_uri: 'https://someone-else.example.com/jwks',
    });
    try {
      const discovery = await getOidcDiscovery(
        'https://issuer-unset.example.com'
      );
      expect(discovery.issuer).toBe('https://someone-else.example.com');
    } finally {
      stub.restore();
    }
  });

  test('fails closed when the discovery document omits the issuer', async () => {
    const stub = stubDiscoveryDoc({
      authorization_endpoint: 'https://issuer-missing.example.com/authorize',
      token_endpoint: 'https://issuer-missing.example.com/token',
      jwks_uri: 'https://issuer-missing.example.com/jwks',
    });
    try {
      await expect(
        getOidcDiscovery('https://issuer-missing.example.com')
      ).rejects.toThrow(/issuer/i);
      await expect(
        getOidcDiscovery('https://issuer-missing.example.com')
      ).rejects.toThrow(/issuer/i);
      expect(stub.calls()).toBe(2);
    } finally {
      stub.restore();
    }
  });
});
