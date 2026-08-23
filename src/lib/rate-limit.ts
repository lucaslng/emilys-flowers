// src/lib/rate-limit.ts
//
// Per-surface, per-IP rate limiting for billable API surfaces, backed by the
// Cloudflare Workers ratelimit binding (`RATE_LIMITER` in wrangler.jsonc —
// 10 requests per 60 s per key). Keys are surface-prefixed so each surface
// gets its own bucket.
//
// Deliberate deviation from the repo's `process.env` convention: object
// bindings cannot ride through `process.env` (OpenNext's populateProcessEnv
// copies only strings), so the binding is read via `getCloudflareContext()`.
//
// The binding is typed structurally instead of via the generated
// `cloudflare-env.d.ts`: regenerating that file augments `NodeJS.ProcessEnv`
// with required string fields, which breaks every `delete process.env.X` in
// the existing unit tests under `tsc --noEmit` (and its runtime-types section
// conflicts with lib.dom). Nothing else in the repo references `CloudflareEnv`,
// so the structural shape below keeps typecheck green while matching the
// Workers `RateLimit` binding contract.
//
// Every failure mode fails OPEN — outside the Workers/OpenNext runtime
// (`bun test`, Node-runtime `bun start`, Playwright serve) the context call
// throws and there is no binding at all, so the guard is a graceful no-op.
// Availability beats quota protection.

import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/** Seconds the client should wait before retrying after a 429. */
const RETRY_AFTER_SECONDS = 60;

/** Structural shape of the Workers ratelimit binding (`RateLimit`). */
interface RateLimiterBinding {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

/**
 * Returns `null` when the request is allowed (or when limiting is
 * unavailable), or a ready-to-return 429 response when the caller exceeded
 * the limit for their IP on the given surface. `surface` prefixes the
 * limiter key (`${surface}:${ip}`) so call sites get isolated buckets.
 */
export async function checkRateLimit(
  request: Request,
  surface: string
): Promise<Response | null> {
  // CF-Connecting-IP is always set by Cloudflare in production; the fallback
  // keeps local Miniflare-emulated testing functional.
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
