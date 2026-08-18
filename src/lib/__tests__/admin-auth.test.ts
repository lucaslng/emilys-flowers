import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { SignJWT } from 'jose';
import {
  buildAuthorizeUrl,
  createSessionToken,
  exchangeCodeForTokens,
  fetchUserInfo,
  generatePkcePair,
  getOidcConfig,
  isAllowedByGroups,
  isOidcConfigured,
  resolveRedirectUri,
  verifySessionToken,
  type OidcConfig,
} from '@/lib/admin-auth';

const REQUIRED_VARS = [
  'OIDC_ISSUER',
  'OIDC_CLIENT_ID',
  'OIDC_CLIENT_SECRET',
  'ADMIN_SESSION_SECRET',
  'ADMIN_OIDC_GROUPS',
];

const BASE_URL = 'https://shop.example.com';
const CALLBACK_URL = `${BASE_URL}/api/admin/callback`;

function setAllEnv() {
  process.env.OIDC_ISSUER = 'https://accounts.example.com';
  process.env.OIDC_CLIENT_ID = 'client-123';
  process.env.OIDC_CLIENT_SECRET = 'client-secret';
  process.env.ADMIN_SESSION_SECRET =
    'a-very-long-admin-session-secret-for-hs256-signing';
  process.env.ADMIN_OIDC_GROUPS = ' admins, shop-owners,, staff ';
  process.env.BASE_URL = BASE_URL;
}

function clearAllEnv() {
  for (const name of REQUIRED_VARS) delete process.env[name];
  delete process.env.BASE_URL;
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
    delete process.env.OIDC_CLIENT_SECRET;
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
    delete process.env.OIDC_ISSUER;
    delete process.env.ADMIN_SESSION_SECRET;
    expect(() => getOidcConfig(CALLBACK_URL)).toThrow(
      'OIDC admin auth is not configured: missing OIDC_ISSUER, ADMIN_SESSION_SECRET'
    );
  });

  test('returns the expected config shape with split/trim/filtered groups', () => {
    const config = getOidcConfig(CALLBACK_URL);
    expect(config).toEqual({
      issuer: 'https://accounts.example.com',
      clientId: 'client-123',
      clientSecret: 'client-secret',
      redirectUri: CALLBACK_URL,
      allowedGroups: ['admins', 'shop-owners', 'staff'],
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
      allowedGroups: ['admins'],
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
    expect(parsed.searchParams.get('scope')).toBe('openid email profile groups');
    expect(parsed.searchParams.get('state')).toBe('state-123');
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge-abc');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
  });
});

describe('isAllowedByGroups', () => {
  test('matches when any allowed group is present in a string[] claim', () => {
    expect(isAllowedByGroups({ groups: ['admins', 'staff'] }, ['admins'])).toBe(
      true
    );
  });

  test('matches a single-string groups claim', () => {
    expect(isAllowedByGroups({ groups: 'shop-owners' }, ['shop-owners'])).toBe(
      true
    );
  });

  test('returns false when no allowed group is present', () => {
    expect(isAllowedByGroups({ groups: ['customers'] }, ['admins'])).toBe(
      false
    );
  });

  test('returns false for an empty allowedGroups list', () => {
    expect(isAllowedByGroups({ groups: ['admins'] }, [])).toBe(false);
  });
});

describe('createSessionToken / verifySessionToken', () => {
  test('roundtrips sub, email, and groups', async () => {
    const config = getOidcConfig(CALLBACK_URL);
    const token = await createSessionToken(config, {
      sub: 'user-42',
      email: 'owner@example.com',
      groups: ['admins'],
    });

    expect(await verifySessionToken(token)).toEqual({
      sub: 'user-42',
      email: 'owner@example.com',
      groups: ['admins'],
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