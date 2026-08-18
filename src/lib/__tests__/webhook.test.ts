import { test, expect, describe, mock } from 'bun:test';
import type Stripe from 'stripe';
import { mapCheckoutSessionToConfirmation } from '@/app/api/webhooks/stripe/route';

// Mock the `stripe` module so the route handler never makes real network
// calls. The route imports `Stripe` as the default export.
mock.module('stripe', () => {
  class MockStripe {
    static createFetchHttpClient() {
      return {};
    }
    webhooks = {
      constructEventAsync: async () => ({
        id: 'evt_mock',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } },
      }),
    };
    checkout = {
      sessions: {
        retrieve: async () => ({}),
      },
    };
  }
  return { default: MockStripe };
});

const { POST } = await import('@/app/api/webhooks/stripe/route');

function makeSession(overrides: Record<string, unknown> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_test_123',
    object: 'checkout.session',
    amount_subtotal: 14998,
    amount_total: 15597,
    total_details: { amount_shipping: 599, amount_discount: 0, amount_tax: 0 },
    customer_details: { email: 'ada@example.com', name: 'Ada Lovelace' },
    line_items: {
      object: 'list',
      has_more: false,
      url: '/v1/checkout/sessions/cs_test_123/line_items',
      data: [
        {
          id: 'li_1',
          object: 'item',
          description: 'Blush Romance Bouquet',
          quantity: 1,
          amount_total: 8999,
          amount_subtotal: 8999,
          amount_discount: 0,
          amount_tax: 0,
          currency: 'cad',
          price: { unit_amount: 8999 },
          metadata: null,
          adjustable_quantity: null,
        },
        {
          id: 'li_2',
          object: 'item',
          description: 'Ribbon Rose',
          quantity: 2,
          amount_total: 5998,
          amount_subtotal: 5998,
          amount_discount: 0,
          amount_tax: 0,
          currency: 'cad',
          price: { unit_amount: 2999 },
          metadata: null,
          adjustable_quantity: null,
        },
      ],
    },
    shipping_details: {
      name: 'Ada Lovelace',
      address: {
        line1: '1 Analytical Way',
        line2: 'Apt 2',
        city: 'Toronto',
        state: 'ON',
        postal_code: 'M5V 2T6',
        country: 'CA',
      },
    },
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

describe('mapCheckoutSessionToConfirmation', () => {
  test('maps a realistic session to order confirmation data', () => {
    const result = mapCheckoutSessionToConfirmation(makeSession());

    expect(result).toEqual({
      to: 'ada@example.com',
      orderNumber: 'cs_test_123',
      customerName: 'Ada Lovelace',
      items: [
        { name: 'Blush Romance Bouquet', quantity: 1, unitAmountCents: 8999 },
        { name: 'Ribbon Rose', quantity: 2, unitAmountCents: 2999 },
      ],
      subtotalCents: 14998,
      shippingCents: 599,
      totalCents: 15597,
      shippingAddress: 'Ada Lovelace\n1 Analytical Way\nApt 2\nToronto, ON\nM5V 2T6\nCA',
    });
  });

  test('returns null when the session has no customer email', () => {
    const session = makeSession({ customer_details: null });
    expect(mapCheckoutSessionToConfirmation(session)).toBeNull();
  });

  test('returns null when customer_details is present but email is missing', () => {
    const session = makeSession({ customer_details: { name: 'No Email' } });
    expect(mapCheckoutSessionToConfirmation(session)).toBeNull();
  });

  test('falls back to amount_total / quantity when price is missing', () => {
    const session = makeSession({
      id: 'cs_test_456',
      line_items: {
        object: 'list',
        has_more: false,
        url: '/v1/checkout/sessions/cs_test_456/line_items',
        data: [
          {
            id: 'li_1',
            object: 'item',
            description: 'Mystery Bouquet',
            quantity: 2,
            amount_total: 1000,
            amount_subtotal: 1000,
            amount_discount: 0,
            amount_tax: 0,
            currency: 'cad',
            price: null,
            metadata: null,
            adjustable_quantity: null,
          },
        ],
      },
    });

    const result = mapCheckoutSessionToConfirmation(session);
    expect(result?.items).toEqual([
      { name: 'Mystery Bouquet', quantity: 2, unitAmountCents: 500 },
    ]);
  });

  test('omits the shipping address when shipping_details is absent', () => {
    const session = makeSession({ shipping_details: null });
    const result = mapCheckoutSessionToConfirmation(session);
    expect(result?.shippingAddress).toBeUndefined();
  });
});

describe('POST /api/webhooks/stripe', () => {
  test('returns 200 { received: true } for an unknown event type', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock';

    const request = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 't=123,v1=abc' },
      body: JSON.stringify({
        id: 'evt_mock',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
  });
});