// Runs against the REAL @/lib/admin-auth — that module must never be mocked (see ./ship-route.test.ts);
// outbound IdP calls are stubbed via globalThis.fetch (they fail, driving the `error=signin` redirect,
// which is enough to prove limiter pass-through).

import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { NextRequest } from 'next/server';
import {
  rateLimitMocks,
  resetRateLimitMocks,
} from './rate-limit-mocks';

const { GET } = await import('@/app/api/admin/callback/route');

const ISSUER = 'https://accounts.example.com';
const SESSION_SECRET = 'a-very-long-admin-session-secret-for-hs256-signing';
const STATE = 'test-state-value';
const VERIFIER = 'test-verifier-value';

function callbackRequest(options?: {
  state?: string;
  cookies?: boolean;
}): NextRequest {
  const state = options?.state ?? STATE;
  const cookieHeader = options?.cookies === false ? undefined : [
    `oidc_state=${STATE}`,
    `oidc_verifier=${VERIFIER}`,
  ].join('; ');
  return new NextRequest(
    `http://localhost/api/admin/callback?code=auth-code&state=${encodeURIComponent(state)}`,
    {
      method: 'GET',
      headers: {
        'CF-Connecting-IP': '203.0.113.7',
        ...(cookieHeader !== undefined ? { cookie: cookieHeader } : {}),
      },
    }
  );
}

describe('GET /api/admin/callback', () => {
  let originalFetch: typeof fetch;
  let originalConsoleError: typeof console.error;
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
    // Part of REQUIRED_ENV_VARS — earlier files delete it from process.env, so it must be set here.
    process.env.ADMIN_OIDC_GROUPS = 'admins';
    resetRateLimitMocks();
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error('IdP egress not expected in this test');
    }) as unknown as typeof fetch;
    // State-invalid callbacks and fail-open paths log before redirecting.
    originalConsoleError = console.error;
    console.error = () => {};
  });

  afterEach(() => {
    console.error = originalConsoleError;
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  test('allows state-valid requests through and keys them by surface-prefixed IP', async () => {
    const response = await GET(callbackRequest());

    // The stubbed IdP calls fail → `error=signin` redirect, but the limiter
    // passed the request through (no 429) under its own bucket.
    expect(response.status).toBe(307);
    expect(response.headers.get('location') ?? '').toContain(
      '/admin/orders?error=signin'
    );
    expect(rateLimitMocks.limitCalls).toEqual(['admin-callback:203.0.113.7']);
  });

  test('returns 429 with Retry-After when the rate limit is exceeded', async () => {
    rateLimitMocks.limitSuccess = false;

    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      throw new Error('should not be called');
    }) as unknown as typeof fetch;

    const response = await GET(callbackRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect((await response.json()).error).toBe('Too many requests');
    expect(fetchCalls).toBe(0);
  });

  test.each([
    ['mismatched state', { state: 'wrong-state' }],
    ['missing cookies', { cookies: false }],
  ])('%s is rejected before the limiter is consulted', async (_label, options) => {
    const response = await GET(callbackRequest(options));

    expect(response.status).toBe(307);
    expect(response.headers.get('location') ?? '').toContain(
      '/admin/orders?error=signin'
    );
    expect(rateLimitMocks.limitCalls).toHaveLength(0);
  });

  test('fails open when getCloudflareContext throws (no Workers runtime)', async () => {
    rateLimitMocks.contextShouldThrow = true;

    const response = await GET(callbackRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get('location') ?? '').toContain(
      '/admin/orders?error=signin'
    );
    expect(rateLimitMocks.limitCalls).toHaveLength(0);
  });

  test('fails open when the limiter binding itself errors', async () => {
    rateLimitMocks.limitShouldThrow = true;

    const response = await GET(callbackRequest());

    expect(response.status).toBe(307);
    expect(rateLimitMocks.limitCalls).toHaveLength(1);
  });
});
