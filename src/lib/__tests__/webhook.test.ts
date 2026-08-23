import { test, expect, describe, beforeEach } from 'bun:test';
import type Stripe from 'stripe';
import { orderEmailMocks, resetOrderEmailMocks } from './order-emails-mocks';

// NOTE: the `stripe` and `resend` mocks live in `./order-emails-mocks`,
// registered exactly once per process. bun's `mock.module` registry is
// process-global and shared across test files, so registering the same
// modules here again would silently replace that registration.

const { POST, mapCheckoutSessionToConfirmation } = await import(
  '@/app/api/webhooks/stripe/route'
);

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
    metadata: { order_number: 'EF-ABC123' },
    payment_status: 'paid',
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

describe('mapCheckoutSessionToConfirmation', () => {
  test('maps a realistic session to order confirmation data', () => {
    const result = mapCheckoutSessionToConfirmation(makeSession());

    expect(result).toEqual({
      to: 'ada@example.com',
      orderNumber: 'EF-ABC123',
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

  test('falls back to metadata shipping_address when shipping_details is null', () => {
    const session = makeSession({
      shipping_details: null,
      metadata: {
        order_number: 'EF-ABC123',
        shipping_address: JSON.stringify({
          name: 'Ada Lovelace',
          line1: '1 Analytical Way',
          line2: 'Apt 2',
          city: 'Toronto',
          province: 'ON',
          postalCode: 'M5V 2T6',
        }),
      },
    });
    const result = mapCheckoutSessionToConfirmation(session);
    expect(result?.shippingAddress).toBe(
      'Ada Lovelace\n1 Analytical Way\nApt 2\nToronto, ON\nM5V 2T6\nCA'
    );
  });

  test('metadata shipping_address fallback omits line2 when absent', () => {
    const session = makeSession({
      shipping_details: null,
      metadata: {
        order_number: 'EF-ABC123',
        shipping_address: JSON.stringify({
          name: 'Ada Lovelace',
          line1: '1 Analytical Way',
          city: 'Toronto',
          province: 'ON',
          postalCode: 'M5V 2T6',
        }),
      },
    });
    const result = mapCheckoutSessionToConfirmation(session);
    expect(result?.shippingAddress).toBe(
      'Ada Lovelace\n1 Analytical Way\nToronto, ON\nM5V 2T6\nCA'
    );
  });

  test('returns undefined shippingAddress when metadata shipping_address is malformed', () => {
    const session = makeSession({
      shipping_details: null,
      metadata: {
        order_number: 'EF-ABC123',
        shipping_address: '{not json',
      },
    });
    const result = mapCheckoutSessionToConfirmation(session);
    expect(result?.shippingAddress).toBeUndefined();
  });

  test('falls back to the session id when metadata has no order_number', () => {
    const session = makeSession({ metadata: {} });
    const result = mapCheckoutSessionToConfirmation(session);
    expect(result?.orderNumber).toBe('cs_test_123');
  });
});

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock';
    process.env.RESEND_API_KEY = 're_test_mock';
    resetOrderEmailMocks();
  });

  function completedEvent(): Stripe.Event {
    return {
      id: 'evt_cs_1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_123' } },
    } as unknown as Stripe.Event;
  }

  function completedRequest(): Request {
    return new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 't=123,v1=abc' },
      body: JSON.stringify(completedEvent()),
    });
  }

  test('returns 200 { received: true } for an unknown event type', async () => {
    const response = await POST(completedRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
  });

  test('sends the confirmation email and stamps metadata on success', async () => {
    orderEmailMocks.currentEvent = completedEvent();
    orderEmailMocks.currentSession = makeSession({
      // Pre-existing keys (e.g. `shipped_at` written later by the admin ship
      // route) must survive the stamp — `sessions.update` replaces the whole
      // metadata map.
      metadata: { shipped_at: '2026-01-01T00:00:00Z' },
    });

    const response = await POST(completedRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(orderEmailMocks.emailSendCalls).toHaveLength(1);
    expect(orderEmailMocks.stripeUpdateCalls).toHaveLength(1);
    expect(orderEmailMocks.stripeUpdateCalls[0].sessionId).toBe('cs_test_123');
    expect(orderEmailMocks.stripeUpdateCalls[0].params.metadata).toEqual(
      expect.objectContaining({
        shipped_at: '2026-01-01T00:00:00Z',
        confirmation_email_sent_at: expect.any(String),
        confirmation_email_id: 're_123',
      })
    );
  });

  test('returns 500 when sending the confirmation email fails', async () => {
    orderEmailMocks.currentEvent = completedEvent();
    orderEmailMocks.currentSession = makeSession();
    orderEmailMocks.emailShouldThrow = true;

    const response = await POST(completedRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to send confirmation email',
    });
    expect(orderEmailMocks.emailSendCalls).toHaveLength(1);
    expect(orderEmailMocks.stripeUpdateCalls).toHaveLength(0);
  });

  test('returns 500 when every metadata stamp attempt fails', async () => {
    orderEmailMocks.currentEvent = completedEvent();
    orderEmailMocks.currentSession = makeSession();
    orderEmailMocks.stripeUpdateShouldThrow = true;

    const response = await POST(completedRequest());

    // Non-2xx makes Stripe redeliver while Resend's idempotency key still
    // dedupes; once a stamp lands, the metadata check dedupes later retries.
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to stamp confirmation metadata',
    });
    expect(orderEmailMocks.emailSendCalls).toHaveLength(1);
    expect(orderEmailMocks.stripeUpdateAttempts).toBe(3);
  });

  test('recovers from a transient stamp failure and returns 200', async () => {
    orderEmailMocks.currentEvent = completedEvent();
    orderEmailMocks.currentSession = makeSession();
    orderEmailMocks.stripeUpdateFailuresRemaining = 1;

    const response = await POST(completedRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(orderEmailMocks.emailSendCalls).toHaveLength(1);
    expect(orderEmailMocks.stripeUpdateAttempts).toBe(2);
    expect(orderEmailMocks.stripeUpdateCalls).toHaveLength(1);
    expect(orderEmailMocks.stripeUpdateCalls[0].params.metadata).toEqual(
      expect.objectContaining({
        confirmation_email_sent_at: expect.any(String),
        confirmation_email_id: 're_123',
      })
    );
  });

  test('skips re-sending when the session already has a confirmation stamp', async () => {
    orderEmailMocks.currentEvent = completedEvent();
    orderEmailMocks.currentSession = makeSession({
      metadata: { confirmation_email_sent_at: '2026-01-01T00:00:00Z' },
    });

    const response = await POST(completedRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(orderEmailMocks.emailSendCalls).toHaveLength(0);
    expect(orderEmailMocks.stripeUpdateCalls).toHaveLength(0);
  });

  test('skips when the session has no customer email', async () => {
    orderEmailMocks.currentEvent = completedEvent();
    orderEmailMocks.currentSession = makeSession({ customer_details: null });

    const response = await POST(completedRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(orderEmailMocks.emailSendCalls).toHaveLength(0);
    expect(orderEmailMocks.stripeUpdateCalls).toHaveLength(0);
  });

  test('skips sending when the session is not yet paid', async () => {
    orderEmailMocks.currentEvent = completedEvent();
    orderEmailMocks.currentSession = makeSession({ payment_status: 'unpaid' });

    const response = await POST(completedRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(orderEmailMocks.emailSendCalls).toHaveLength(0);
    expect(orderEmailMocks.stripeUpdateCalls).toHaveLength(0);
  });
});
