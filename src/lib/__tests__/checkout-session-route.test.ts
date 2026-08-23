// src/lib/__tests__/checkout-session-route.test.ts
//
// Tests for `GET /api/checkout/session` — the checkout-success retrieval
// surface. The session id is format-checked against ^cs_(live|test)_ BEFORE
// any Stripe call, and the response is a sanitized projection only:
// { items, subtotal, shipping, total, orderNumber }. customer_details and
// metadata must never leak.
//
// The `stripe` mock is NOT registered here: bun's `mock.module` registry is
// process-global across test files (see ./order-emails-mocks.ts), so this
// file reuses the shared registration and drives it through the exported
// `orderEmailMocks` state object. The rate-limit guard's
// `@opennextjs/cloudflare` mock lives in ./rate-limit-mocks.ts (registered
// once per process, driven via `rateLimitMocks`).

import { test, expect, describe, beforeEach } from 'bun:test';
import {
  orderEmailMocks,
  resetOrderEmailMocks,
} from './order-emails-mocks';
import {
  rateLimitMocks,
  resetRateLimitMocks,
} from './rate-limit-mocks';

const { GET } = await import('@/app/api/checkout/session/route');

function sessionRequest(sessionId: string): Request {
  return new Request(
    `http://localhost/api/checkout/session?session_id=${encodeURIComponent(sessionId)}`,
    { method: 'GET' }
  );
}

function makeSession(): object {
  return {
    id: 'cs_test_abc123',
    object: 'checkout.session',
    amount_subtotal: 14997,
    amount_total: 15965,
    total_details: {
      amount_shipping: 968,
    },
    // Sensitive fields that must NOT appear in the response:
    customer_details: { email: 'ada@example.com', name: 'Ada Lovelace' },
    metadata: {
      order_number: 'EF-ABC123',
      chitchats_shipment_id: 'shp_123',
      shipping_address: '{"name":"Ada Lovelace"}',
    },
    line_items: {
      data: [
        {
          description: 'Ribbon Rose',
          quantity: 2,
          price: {
            unit_amount: 2999,
            product: { id: 'prod_rose', name: 'Ribbon Rose' },
          },
        },
        {
          description: 'Blush Romance Bouquet',
          quantity: 1,
          price: {
            unit_amount: 8999,
            product: { id: 'prod_bouquet', name: 'Blush Romance Bouquet' },
          },
        },
      ],
    },
  };
}

describe('GET /api/checkout/session', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    resetOrderEmailMocks();
    resetRateLimitMocks();
    orderEmailMocks.currentSession = makeSession();
  });

  test('returns the sanitized projection for a valid cs_test_ id', async () => {
    const response = await GET(sessionRequest('cs_test_abc123'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [
        { name: 'Ribbon Rose', quantity: 2, unitAmount: 2999 },
        { name: 'Blush Romance Bouquet', quantity: 1, unitAmount: 8999 },
      ],
      subtotal: 14997,
      shipping: 968,
      total: 15965,
      orderNumber: 'EF-ABC123',
    });

    expect(orderEmailMocks.stripeRetrieveCalls).toHaveLength(1);
    expect(orderEmailMocks.stripeRetrieveCalls[0].id).toBe('cs_test_abc123');
    expect(orderEmailMocks.stripeRetrieveCalls[0].params).toEqual({
      expand: ['line_items.data.price.product'],
    });
  });

  test('accepts a cs_live_ id (format guard is mode-agnostic)', async () => {
    const response = await GET(sessionRequest('cs_live_xyz'));
    expect(response.status).toBe(200);
    expect(orderEmailMocks.stripeRetrieveCalls[0].id).toBe('cs_live_xyz');
  });

  test.each([
    ['empty string', ''],
    ['missing prefix', 'abc123'],
    ['wrong object type', 'seti_abc123'],
    ['pi id', 'pi_abc123'],
    ['subclassed id', 'cs_test'],
    ['trailing underscore only', 'cs_test_'],
    ['path traversal', '../../etc/passwd'],
    ['uppercase prefix', 'CS_TEST_abc123'],
  ])('rejects %s without hitting Stripe', async (_label, bad) => {
    const response = await GET(sessionRequest(bad));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Invalid session id.');
    expect(orderEmailMocks.stripeRetrieveCalls).toHaveLength(0);
  });

  test('never returns customer_details or non-order_number metadata', async () => {
    const response = await GET(sessionRequest('cs_test_abc123'));
    const body = (await response.json()) as Record<string, unknown>;

    expect(Object.keys(body).sort()).toEqual([
      'items',
      'orderNumber',
      'shipping',
      'subtotal',
      'total',
    ]);
    expect(JSON.stringify(body)).not.toContain('ada@example.com');
    expect(JSON.stringify(body)).not.toContain('Ada Lovelace');
    expect(JSON.stringify(body)).not.toContain('shp_123');
    expect(JSON.stringify(body)).not.toContain('shipping_address');
  });

  test('returns 503 when STRIPE_SECRET_KEY is absent', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const response = await GET(sessionRequest('cs_test_abc123'));

    expect(response.status).toBe(503);
    expect(orderEmailMocks.stripeRetrieveCalls).toHaveLength(0);
  });

  test('returns 500 when the Stripe call fails', async () => {
    orderEmailMocks.retrieveShouldThrow = true;

    const response = await GET(sessionRequest('cs_test_abc123'));

    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe(
      'Could not retrieve your order.'
    );
  });

  test('rate limiter allows the request through and keys it by IP', async () => {
    const request = new Request(
      'http://localhost/api/checkout/session?session_id=cs_test_abc123',
      { method: 'GET', headers: { 'CF-Connecting-IP': '203.0.113.7' } }
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(rateLimitMocks.limitCalls).toEqual(['203.0.113.7']);
    expect(orderEmailMocks.stripeRetrieveCalls).toHaveLength(1);
  });

  test('returns 429 with Retry-After when the rate limit is exceeded', async () => {
    rateLimitMocks.limitSuccess = false;

    const response = await GET(sessionRequest('cs_test_abc123'));

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect((await response.json()).error).toBe('Too many requests');
    // The billable Stripe call must never happen on a rejected request.
    expect(orderEmailMocks.stripeRetrieveCalls).toHaveLength(0);
  });

  test('fails open when getCloudflareContext throws (no Workers runtime)', async () => {
    rateLimitMocks.contextShouldThrow = true;

    const response = await GET(sessionRequest('cs_test_abc123'));

    expect(response.status).toBe(200);
    expect(orderEmailMocks.stripeRetrieveCalls).toHaveLength(1);
  });

  test('fails open when the limiter binding itself errors', async () => {
    rateLimitMocks.limitShouldThrow = true;

    const response = await GET(sessionRequest('cs_test_abc123'));

    expect(response.status).toBe(200);
    // The limiter was consulted (and threw), but availability wins.
    expect(rateLimitMocks.limitCalls).toHaveLength(1);
    expect(orderEmailMocks.stripeRetrieveCalls).toHaveLength(1);
  });

  test('malformed session ids are rejected before the limiter is consulted', async () => {
    const response = await GET(sessionRequest('../../etc/passwd'));

    expect(response.status).toBe(400);
    expect(rateLimitMocks.limitCalls).toHaveLength(0);
    expect(orderEmailMocks.stripeRetrieveCalls).toHaveLength(0);
  });
});
