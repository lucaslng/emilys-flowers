// Per-surface, per-IP rate limiting backed by the Workers ratelimit binding
// (RATE_LIMITER in wrangler.jsonc — 10 requests per 60s per key).
//
// Object bindings can't ride process.env (OpenNext's populateProcessEnv copies only strings), hence getCloudflareContext().
//
// The binding is typed structurally instead of via the generated cloudflare-env.d.ts: regenerating that file adds required
// NodeJS.ProcessEnv fields, which breaks every `delete process.env.X` in the unit tests under tsc --noEmit.
//
// Every failure mode fails OPEN — outside the Workers runtime (bun test, Playwright serve) there is no binding at all;
// availability beats quota protection.

import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/** Seconds the client should wait before retrying after a 429. */
const RETRY_AFTER_SECONDS = 60;

/** Structural shape of the Workers ratelimit binding (`RateLimit`). */
interface RateLimiterBinding {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

/** null = allowed (or limiting unavailable); Response = ready-to-return 429. `surface` prefixes the key so call sites get isolated buckets. */
export async function checkRateLimit(
  request: Request,
  surface: string
): Promise<Response | null> {
  // CF-Connecting-IP is always set by Cloudflare in production; the fallback keeps local Miniflare testing functional.
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const key = `${surface}:${ip}`;

  try {
    const { env } = getCloudflareContext() as unknown as {
      env: { RATE_LIMITER?: RateLimiterBinding };
    };
    const limiter = env.RATE_LIMITER;
    if (!limiter) {
      return null;
    }

    const { success } = await limiter.limit({ key });
    if (success) {
      return null;
    }

    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(RETRY_AFTER_SECONDS) },
      }
    );
  } catch {
    // No OpenNext/Workers runtime, missing binding, or limiter error — fail open.
    return null;
  }
}
