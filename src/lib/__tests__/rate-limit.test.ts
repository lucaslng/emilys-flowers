// Unit tests for `checkRateLimit` (src/lib/rate-limit.ts) — the shared
// rate-limit guard. Focus: the limiter key MUST be surface-prefixed
// (`${surface}:${ip}`) so each API surface gets its own bucket (issue #209),
// plus the fail-open contract.
// The `@opennextjs/cloudflare` mock lives in ./rate-limit-mocks.ts
// (registered once per process, driven via `rateLimitMocks`).

import { test, expect, describe, beforeEach } from 'bun:test';
import {
  rateLimitMocks,
  resetRateLimitMocks,
} from './rate-limit-mocks';

const { checkRateLimit } = await import('@/lib/rate-limit');

function requestAt(ip?: string): Request {
  return new Request('http://localhost/api/checkout', {
    method: 'POST',
    headers: ip ? { 'CF-Connecting-IP': ip } : {},
  });
}

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimitMocks();
  });

  test('keys the limiter by surface-prefixed IP', async () => {
    const result = await checkRateLimit(requestAt('203.0.113.7'), 'checkout');

    expect(result).toBeNull();
    expect(rateLimitMocks.limitCalls).toEqual(['checkout:203.0.113.7']);
  });

  test('distinct surfaces get distinct buckets for the same IP', async () => {
    await checkRateLimit(requestAt('203.0.113.7'), 'checkout');
    await checkRateLimit(requestAt('203.0.113.7'), 'checkout-session');

    expect(rateLimitMocks.limitCalls).toEqual([
      'checkout:203.0.113.7',
      'checkout-session:203.0.113.7',
    ]);
  });

  test('falls back to "unknown" when CF-Connecting-IP is absent', async () => {
    await checkRateLimit(requestAt(), 'checkout');

    expect(rateLimitMocks.limitCalls).toEqual(['checkout:unknown']);
  });

  test('returns 429 with Retry-After when the limit is exceeded', async () => {
    rateLimitMocks.limitSuccess = false;

    const result = await checkRateLimit(requestAt('203.0.113.7'), 'checkout');

    expect(result?.status).toBe(429);
    expect(result?.headers.get('retry-after')).toBe('60');
    expect((await result?.json())?.error).toBe('Too many requests');
  });

  test('fails open when getCloudflareContext throws (no Workers runtime)', async () => {
    rateLimitMocks.contextShouldThrow = true;

    const result = await checkRateLimit(requestAt('203.0.113.7'), 'checkout');

    expect(result).toBeNull();
  });

  test('fails open when the limiter binding itself errors', async () => {
    rateLimitMocks.limitShouldThrow = true;

    const result = await checkRateLimit(requestAt('203.0.113.7'), 'checkout');

    expect(result).toBeNull();
    // The limiter was consulted (and threw), but availability wins.
    expect(rateLimitMocks.limitCalls).toHaveLength(1);
  });
});
