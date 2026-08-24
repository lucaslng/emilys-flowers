// Tests for `GET /api/admin/login` rate limiting (issue #217). The route runs
// against the REAL `@/lib/admin-auth` — that module must never be mocked (see
// ./ship-route.test.ts); outbound IdP discovery is stubbed via
// globalThis.fetch instead. The rate-limit guard's `@opennextjs/cloudflare`
// mock lives in ./rate-limit-mocks.ts (registered once per process, driven
// via `rateLimitMocks`).

import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import {
  rateLimitMocks,
  resetRateLimitMocks,
} from './rate-limit-mocks';

const { GET } = await import('@/app/api/admin/login/route');

const ISSUER = 'https://accounts.example.com';
const SESSION_SECRET = 'a-very-long-admin-session-secret-for-hs256-signing';

function loginRequest(): Request {
  return new Request('http://localhost/api/admin/login', {
    method: 'GET',
    headers: { 'CF-Connecting-IP': '203.0.113.7' },
  });
}

describe('GET /api/admin/login', () => {
  let originalFetch: typeof fetch;
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {
      OIDC_ISSUER: process.env.OIDC_ISSUER,
      OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID,
      OIDC_CLIENT_SECRET: process.env.OIDC_CLIENT_SECRET,
      ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
      ADMIN_OIDC_GROUPS: process.env.ADMIN_OIDC_GROUPS,
    };
    process.env.OIDC_ISSUER = ISSUER;
    process.env.OIDC_CLIENT_ID = 'client-id';
    process.env.OIDC_CLIENT_SECRET = 'client-secret';
    process.env.ADMIN_SESSION_SECRET = SESSION_SECRET;
    // Part of REQUIRED_ENV_VARS — earlier files (e.g. admin-auth.test.ts)
    // delete it from process.env, so it must be set here, not via .env.
    process.env.ADMIN_OIDC_GROUPS = 'admins';
    resetRateLimitMocks();
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          issuer: ISSUER,
          authorization_endpoint: `${ISSUER}/authorize`,
          token_endpoint: `${ISSUER}/token`,
          jwks_uri: `${ISSUER}/jwks`,
        }),
        { status: 200 }
      )) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  test('allows the request through and keys it by surface-prefixed IP', async () => {
    const response = await GET(loginRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get('location') ?? '').toStartWith(
      `${ISSUER}/authorize`
    );
    expect(rateLimitMocks.limitCalls).toEqual(['admin-login:203.0.113.7']);
  });

  test('returns 429 with Retry-After when the rate limit is exceeded', async () => {
    rateLimitMocks.limitSuccess = false;

    const response = await GET(loginRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect((await response.json()).error).toBe('Too many requests');
    // The outbound IdP discovery fetch must never happen on a rejected request.
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      throw new Error('should not be called');
    }) as unknown as typeof fetch;
    await GET(loginRequest());
    expect(fetchCalls).toBe(0);
  });

  test('fails open when getCloudflareContext throws (no Workers runtime)', async () => {
    rateLimitMocks.contextShouldThrow = true;

    const response = await GET(loginRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get('location') ?? '').toStartWith(
      `${ISSUER}/authorize`
    );
  });

  test('fails open when the limiter binding itself errors', async () => {
    rateLimitMocks.limitShouldThrow = true;

    const response = await GET(loginRequest());

    expect(response.status).toBe(307);
    // The limiter was consulted (and threw), but availability wins.
    expect(rateLimitMocks.limitCalls).toHaveLength(1);
  });

  test('unconfigured OIDC is rejected before the limiter is consulted', async () => {
    delete process.env.OIDC_ISSUER;

    const response = await GET(loginRequest());

    expect(response.status).toBe(500);
    expect(rateLimitMocks.limitCalls).toHaveLength(0);
  });
});
