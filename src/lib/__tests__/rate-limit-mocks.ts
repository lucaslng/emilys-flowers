// bun's mock.module registry is process-global across test files, so this @opennextjs/cloudflare mock is
// registered exactly once here; tests drive it via the exported `rateLimitMocks` state object. The real
// getCloudflareContext() throws outside a Workers runtime, so the fake mirrors both shapes.

import { mock } from 'bun:test';

export const rateLimitMocks = {
  limitSuccess: true,
  contextShouldThrow: false,
  limitShouldThrow: false,
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
