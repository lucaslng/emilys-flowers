// src/lib/__tests__/order-emails-mocks.ts
//
// Shared mock registrations for the order-email route tests (webhook + ship).
//
// bun's `mock.module` registry is PROCESS-GLOBAL: a registration is shared
// across every test file in one `bun test` process and is never torn down.
// Registering the same module from more than one test file silently replaces
// the registration, so whichever file registers last wins globally and the
// other file observes the wrong mock. To avoid that, the `stripe` and
// `@/lib/email` mocks live here and are registered EXACTLY ONCE — the helper
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
        retrieve: async () => orderEmailMocks.currentSession,
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

// Mock `@/lib/email` so sends are controllable per test. Both senders are
// provided so the namespace is complete for whichever route is under test.
// Type-only imports (`type EmailLineItem` / `type OrderConfirmationData`)
// are erased at runtime, so exporting just the functions is sufficient.
mock.module('@/lib/email', () => {
  const send = async (...args: unknown[]) => {
    orderEmailMocks.emailSendCalls.push(args);
    if (orderEmailMocks.emailShouldThrow) {
      throw new Error('Resend send failed');
    }
    return { id: 're_123' };
  };
  return {
    sendOrderConfirmationEmail: send,
    sendShippedEmail: send,
  };
});
