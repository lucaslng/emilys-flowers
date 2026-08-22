// src/lib/__tests__/order-emails-mocks.ts
//
// Shared mock registrations for the order-email route tests (webhook + ship).
//
// bun's `mock.module` registry is PROCESS-GLOBAL: a registration is shared
// across every test file in one `bun test` process and is never torn down.
// Registering the same module from more than one test file silently replaces
// the registration, so whichever file registers last wins globally and the
// other file observes the wrong mock. To avoid that, the `stripe` and
// `resend` mocks live here and are registered EXACTLY ONCE — the helper
// module is evaluated a single time per process regardless of how many test
// files import it.
//
// Test files drive the mocks by mutating the exported `orderEmailMocks`
// state object (property writes, never reassignment) and call
// `resetOrderEmailMocks()` in `beforeEach`.

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
  stripeUpdateCalls: [] as Array<{
    sessionId: string;
    params: { metadata: Record<string, string> };
  }>,
  emailSendCalls: [] as unknown[][],
  emailShouldThrow: false,
  stripeUpdateShouldThrow: false,
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
  orderEmailMocks.stripeUpdateCalls.length = 0;
  orderEmailMocks.emailSendCalls.length = 0;
  orderEmailMocks.emailShouldThrow = false;
  orderEmailMocks.stripeUpdateShouldThrow = false;
}

// Mock the `stripe` module so the route handlers never make real network
// calls. The routes import `Stripe` as the default export and construct it
// with `new Stripe(key, { httpClient: Stripe.createFetchHttpClient() })`, so
// the mock needs the static factory plus the `webhooks` / `checkout`
// namespaces used by the webhook and ship routes.
mock.module('stripe', () => {
  class MockStripe {
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
          orderEmailMocks.stripeRetrieveCalls.push({ id, params });
          return orderEmailMocks.currentSession;
        },
        update: async (
          sessionId: string,
          params: { metadata: Record<string, string> }
        ) => {
          if (orderEmailMocks.stripeUpdateShouldThrow) {
            throw new Error('Stripe update failed');
          }
          orderEmailMocks.stripeUpdateCalls.push({ sessionId, params });
        },
      },
    };
  }
  return { default: MockStripe };
});

// Mock the `resend` package (the leaf dependency) so sends are controllable
// per test. `@/lib/email` is deliberately NOT mocked: email.test.ts tests the
// real senders in the same process, and bun's `mock.module` registry is
// process-global — mocking `@/lib/email` here replaced the real module for
// email.test.ts on CI and broke it. The real senders construct the client via
// `new Resend(requireApiKey())`, so mocking `resend` gives the routes a
// controllable client while the real email.ts logic (payload building, error
// wrapping, idempotency option) still runs.
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
