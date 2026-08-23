// Shared mock registration for `@opennextjs/cloudflare` (the module that
// exposes Workers bindings to the app). bun's `mock.module` registry is
// PROCESS-GLOBAL across test files, so this is registered exactly once here;
// test files drive it through the exported `rateLimitMocks` state object.
// The real `getCloudflareContext()` throws outside the Workers/OpenNext
// runtime, so the fake mirrors both shapes: a working context with a
// controllable `RATE_LIMITER`, and a throwing context.

import { mock } from 'bun:test';

export const rateLimitMocks = {
  /** Result returned by `RATE_LIMITER.limit()`. */
  limitSuccess: true,
  /** When true, `getCloudflareContext()` throws (no Workers runtime). */
  contextShouldThrow: false,
  /** When true, the limiter binding itself errors. */
  limitShouldThrow: false,
  /** Keys passed to `limit()`, in call order. */
  limitCalls: [] as string[],
};

export function resetRateLimitMocks() {
  rateLimitMocks.limitSuccess = true;
  rateLimitMocks.contextShouldThrow = false;
  rateLimitMocks.limitShouldThrow = false;
  rateLimitMocks.limitCalls.length = 0;
}

mock.module('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => {
    if (rateLimitMocks.contextShouldThrow) {
      throw new Error('getCloudflareContext: not in a Workers context');
    }
    return {
      env: {
        RATE_LIMITER: {
          limit: async ({ key }: { key: string }) => {
            rateLimitMocks.limitCalls.push(key);
            if (rateLimitMocks.limitShouldThrow) {
              throw new Error('ratelimit binding error');
            }
            return { success: rateLimitMocks.limitSuccess };
          },
        },
      },
    };
  },
}));
