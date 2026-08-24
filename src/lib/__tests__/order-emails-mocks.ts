// bun's mock.module registry is process-global and never torn down: a second registration of the same module in
// another test file would silently replace this one. The `stripe` and `resend` mocks are therefore registered
// EXACTLY ONCE here; tests drive them via the exported state object + resetOrderEmailMocks() in beforeEach.

import { mock } from 'bun:test';
import type Stripe from 'stripe';

export const orderEmailMocks = {
  currentEvent: {
    id: 'evt_mock',
    type: 'payment_intent.succeeded',
    data: { object: { id: 'pi_123' } },
  } as unknown as Stripe.Event,
  currentSession: {} as object,
  stripeRetrieveCalls: [] as Array<{ id: string; params: unknown }>,
  retrieveShouldThrow: false,
  retrieveShouldThrowResourceMissing: false,
  stripeUpdateCalls: [] as Array<{
    sessionId: string;
    params: { metadata: Record<string, string> };
  }>,
  emailSendCalls: [] as unknown[][],
  emailShouldThrow: false,
  stripeUpdateShouldThrow: false,
  stripeUpdateFailuresRemaining: 0,
  stripeUpdateAttempts: 0,
};

export function resetOrderEmailMocks() {
  orderEmailMocks.currentEvent = {
    id: 'evt_mock',
    type: 'payment_intent.succeeded',
    data: { object: { id: 'pi_123' } },
  } as unknown as Stripe.Event;
  orderEmailMocks.currentSession = {};
  orderEmailMocks.stripeRetrieveCalls.length = 0;
  orderEmailMocks.retrieveShouldThrow = false;
  orderEmailMocks.retrieveShouldThrowResourceMissing = false;
  orderEmailMocks.stripeUpdateCalls.length = 0;
  orderEmailMocks.emailSendCalls.length = 0;
  orderEmailMocks.emailShouldThrow = false;
  orderEmailMocks.stripeUpdateShouldThrow = false;
  orderEmailMocks.stripeUpdateFailuresRemaining = 0;
  orderEmailMocks.stripeUpdateAttempts = 0;
}

// Mirrors the real SDK surface the routes use: static httpClient factory plus
// the webhooks/checkout namespaces. The static `errors` namespace lets routes
// instanceof-check typed Stripe errors (resource_missing → 404).
mock.module('stripe', () => {
  class MockStripeInvalidRequestError extends Error {
    readonly type = 'StripeInvalidRequestError';
    readonly code?: string;
    constructor(message: string, code?: string) {
      super(message);
      this.code = code;
    }
  }
  class MockStripe {
    static errors = { StripeInvalidRequestError: MockStripeInvalidRequestError };
    static createFetchHttpClient() {
      return {};
    }
    webhooks = {
      constructEventAsync: async () => orderEmailMocks.currentEvent,
    };
    checkout = {
      sessions: {
        retrieve: async (id: string, params?: unknown) => {
          if (orderEmailMocks.retrieveShouldThrow) {
            throw new Error('Stripe retrieve failed');
          }
          if (orderEmailMocks.retrieveShouldThrowResourceMissing) {
            throw new MockStripeInvalidRequestError(
              'No such checkout.session',
              'resource_missing'
            );
          }
          orderEmailMocks.stripeRetrieveCalls.push({ id, params });
          return orderEmailMocks.currentSession;
        },
        update: async (
          sessionId: string,
          params: { metadata: Record<string, string> }
        ) => {
          orderEmailMocks.stripeUpdateAttempts += 1;
          const shouldFail =
            orderEmailMocks.stripeUpdateShouldThrow ||
            orderEmailMocks.stripeUpdateFailuresRemaining > 0;
          if (shouldFail) {
            if (orderEmailMocks.stripeUpdateFailuresRemaining > 0) {
              orderEmailMocks.stripeUpdateFailuresRemaining -= 1;
            }
            throw new Error('Stripe update failed');
          }
          orderEmailMocks.stripeUpdateCalls.push({ sessionId, params });
        },
      },
    };
  }
  return { default: MockStripe };
});

// Mocking the leaf `resend` package keeps the real email.ts logic running; @/lib/email must stay unmocked —
// the process-global registry replaced it for email.test.ts on CI.
mock.module('resend', () => {
  class MockResend {
    emails = {
      send: async (...args: unknown[]) => {
        orderEmailMocks.emailSendCalls.push(args);
        if (orderEmailMocks.emailShouldThrow) {
          throw new Error('Resend send failed');
        }
        return { data: { id: 're_123' }, error: null, headers: null };
      },
    };
  }
  return { Resend: MockResend };
});
