// src/lib/__tests__/checkout-route.test.ts
//
// Tests for `POST /api/checkout` with ChitChats shipping configured.
//
// bun runs each test file in its own process, so the `stripe`,
// `@/lib/chitchats`, and `@/lib/catalog-index` mocks registered here are
// per-file and don't collide with the process-global mocks in
// `./order-emails-mocks.ts` (webhook/ship tests).
//
// `@/lib/chitchats` is mocked with the REAL pure helpers (spread from the
// pre-imported module) and only `isChitchatsConfigured` / `createShipment`
// overridden — the route's pure logic (rate picking, payload building,
// address validation) still runs for real.
//
// `@/lib/catalog-index` is mocked so catalog resolution never touches Stripe:
// the route must resolve {productId, quantity} pairs against this index and
// reject unknown product ids.

import { test, expect, describe, beforeEach, mock } from 'bun:test';
import type { ChitChatsShipment } from '@/lib/chitchats';

const realChitchats = await import('@/lib/chitchats');

const checkoutMocks = {
  chitchatsConfigured: true,
  shipmentShouldThrow: false,
  shipment: {
    id: 'shp_123',
    tracking_url: 'https://staging.chitchats.com/tracking/shp_123',
    rates: [
      {
        postage_type: 'expedited',
        postage_description: 'Expedited Parcel',
        payment_amount: '9.68',
        delivery_time_description: '2-4 business days',
      },
    ],
  } as ChitChatsShipment,
  sessionCreateCalls: [] as unknown[],
  shipmentCreateCalls: [] as unknown[],
};

mock.module('@/lib/chitchats', () => ({
  ...realChitchats,
  isChitchatsConfigured: () => checkoutMocks.chitchatsConfigured,
  createShipment: async (input: unknown) => {
    checkoutMocks.shipmentCreateCalls.push(input);
    if (checkoutMocks.shipmentShouldThrow) {
      throw new Error('ChitChats API error (500): boom');
    }
    return checkoutMocks.shipment;
  },
}));

// The catalog index the route resolves productIds against. Product ids are
// Stripe product ids; prices/names come from here, never from the request.
const catalogIndex = new Map(
  [
    {
      productId: 'prod_rose',
      entry: { priceId: 'price_rose', name: 'Ribbon Rose', unitAmount: 2999 },
    },
    {
      productId: 'prod_bouquet',
      entry: {
        priceId: 'price_bouquet',
        name: 'Blush Romance Bouquet',
        unitAmount: 8999,
      },
    },
  ].map(({ productId, entry }) => [productId, entry])
);

mock.module('@/lib/catalog-index', () => ({
  getCatalogIndex: async () => catalogIndex,
}));

mock.module('stripe', () => {
  class MockStripe {
    static createFetchHttpClient() {
      return {};
    }
    checkout = {
      sessions: {
        create: async (params: unknown) => {
          checkoutMocks.sessionCreateCalls.push(params);
          return {
            url: 'https://checkout.stripe.com/c/pay/cs_test_123',
            id: 'cs_test_123',
          };
        },
      },
    };
  }
  return { default: MockStripe };
});

const { POST } = await import('@/app/api/checkout/route');

// The wire shape: product references + quantities ONLY. Names/prices in the
// request would be a security regression (issue #170).
const validItems = [
  { productId: 'prod_rose', quantity: 2 },
  { productId: 'prod_bouquet', quantity: 1 },
];

const validAddress = {
  name: 'Ada Lovelace',
  line1: '1 Analytical Way',
  line2: 'Apt 4',
  city: 'Toronto',
  province: 'ON',
  postalCode: 'M5V 2T6',
};

function checkoutRequest(body: unknown): Request {
  return new Request('http://localhost/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/checkout with ChitChats configured', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.CHITCHATS_CLIENT_ID = 'client_123';
    process.env.CHITCHATS_ACCESS_TOKEN = 'token_123';
    checkoutMocks.chitchatsConfigured = true;
    checkoutMocks.shipmentShouldThrow = false;
    checkoutMocks.shipment.rates = [
      {
        postage_type: 'expedited',
        postage_description: 'Expedited Parcel',
        payment_amount: '9.68',
        delivery_time_description: '2-4 business days',
      },
    ];
    checkoutMocks.sessionCreateCalls.length = 0;
    checkoutMocks.shipmentCreateCalls.length = 0;
  });

  test('creates a session with catalog-resolved price ids and the cheapest ChitChats rate as the shipping option', async () => {
    const response = await POST(
      checkoutRequest({ items: validItems, address: validAddress })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    });

    expect(checkoutMocks.sessionCreateCalls).toHaveLength(1);
    const params = checkoutMocks.sessionCreateCalls[0] as Record<string, unknown>;

    // line_items use Stripe Price objects resolved from the catalog — never
    // inline price_data built from client-supplied values.
    expect(params.line_items).toEqual([
      { price: 'price_rose', quantity: 2 },
      { price: 'price_bouquet', quantity: 1 },
    ]);

    expect(params.shipping_options).toEqual([
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: 968, currency: 'cad' },
          display_name: 'Expedited Parcel',
        },
      },
    ]);
    expect(params.billing_address_collection).toBe('required');
    // The address is collected on our own checkout page — Stripe must not
    // ask for a second one.
    expect(params.shipping_address_collection).toBeUndefined();

    const metadata = params.metadata as Record<string, string>;
    expect(metadata.order_number).toMatch(
      /^EF-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/
    );
    expect(metadata.chitchats_shipment_id).toBe('shp_123');
    expect(metadata.chitchats_tracking_url).toBe(
      'https://staging.chitchats.com/tracking/shp_123'
    );
    expect(metadata.chitchats_postage_type).toBe('expedited');
    expect(JSON.parse(metadata.shipping_address)).toEqual(validAddress);

    // Real success URLs carry only the session id placeholder — no items=.
    const successUrl = params.success_url as string;
    expect(successUrl).toContain('&session_id={CHECKOUT_SESSION_ID}');
    expect(successUrl).not.toContain('&items=');
    expect(successUrl).toContain('&shipping=968');
  });

  test('builds the ChitChats shipment payload from catalog-resolved names/prices', async () => {
    await POST(checkoutRequest({ items: validItems, address: validAddress }));

    expect(checkoutMocks.shipmentCreateCalls).toHaveLength(1);
    const payload = checkoutMocks.shipmentCreateCalls[0] as {
      value: string;
      line_items: Array<{
        description: string;
        value_amount: string;
        quantity: number;
        currency_code: 'cad';
      }>;
    };

    // Declared customs/insurance value comes from the catalog subtotal
    // (2999*2 + 8999*1 = 14997 cents), not from anything the client sent.
    expect(payload.value).toBe('149.97');
    expect(payload.line_items).toEqual([
      {
        description: 'Ribbon Rose',
        value_amount: '59.98',
        quantity: 2,
        currency_code: 'cad',
      },
      {
        description: 'Blush Romance Bouquet',
        value_amount: '89.99',
        quantity: 1,
        currency_code: 'cad',
      },
    ]);
  });

  test('charges the valid rate (not $0) when a rate has a malformed payment_amount', async () => {
    checkoutMocks.shipment.rates = [
      {
        postage_type: 'broken',
        postage_description: 'Broken',
        payment_amount: 'not-a-number',
      },
      {
        postage_type: 'standard',
        postage_description: 'Standard',
        payment_amount: '9.68',
      },
    ];

    const response = await POST(
      checkoutRequest({ items: validItems, address: validAddress })
    );

    expect(response.status).toBe(200);
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(1);
    const params = checkoutMocks.sessionCreateCalls[0] as Record<string, unknown>;
    expect(params.shipping_options).toEqual([
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: 968, currency: 'cad' },
          display_name: 'Standard',
        },
      },
    ]);
    const metadata = params.metadata as Record<string, string>;
    expect(metadata.chitchats_postage_type).toBe('standard');
    expect(params.success_url).toContain('&shipping=968');
  });

  test('returns 400 when the address is missing', async () => {
    const response = await POST(checkoutRequest({ items: validItems }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'A delivery address is required to calculate shipping.',
    });
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(0);
  });

  test('returns 400 when the address is invalid', async () => {
    const response = await POST(
      checkoutRequest({
        items: validItems,
        address: { ...validAddress, province: 'XX' },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'A delivery address is required to calculate shipping.',
    });
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(0);
  });

  test('returns 502 when ChitChats shipment creation fails (fail closed)', async () => {
    checkoutMocks.shipmentShouldThrow = true;

    const response = await POST(
      checkoutRequest({ items: validItems, address: validAddress })
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "We couldn't calculate shipping right now. Please try again.",
    });
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(0);
  });

  test('creates a session without shipping options when ChitChats is not configured', async () => {
    checkoutMocks.chitchatsConfigured = false;

    // No address required on this path — matches the pre-ChitChats behavior.
    const response = await POST(checkoutRequest({ items: validItems }));

    expect(response.status).toBe(200);
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(1);
    const params = checkoutMocks.sessionCreateCalls[0] as Record<string, unknown>;
    expect(params.shipping_options).toBeUndefined();
    expect(params.shipping_address_collection).toBeUndefined();
    expect(params.billing_address_collection).toBe('required');
    expect(params.success_url).not.toContain('&shipping=');
  });

  test('simulates success when STRIPE_SECRET_KEY is absent (items= URL kept for E2E, but no itemized receipt)', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const response = await POST(checkoutRequest({ items: validItems }));

    expect(response.status).toBe(200);
    const json = (await response.json()) as { url: string };
    expect(json.url).toContain('/checkout/success?success=true&order=EF-');
    // The simulated URL still carries `items=` so E2E synthetic-URL
    // compatibility is preserved — but the payload shape ({productId,
    // quantity}) no longer decodes to line items, so the simulated success
    // page renders the generic confirmation WITHOUT an itemized receipt
    // (pinned by the decodeOrderItems test in order.test.ts).
    expect(json.url).toContain('&items=');
    expect(json.url).not.toContain('session_id=');
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(0);
  });

  // --- Catalog-membership rejections (issue #170) ---

  test('returns 400 for an unknown productId', async () => {
    const response = await POST(
      checkoutRequest({
        items: [{ productId: 'prod_not_in_catalog', quantity: 1 }],
        address: validAddress,
      })
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('prod_not_in_catalog');
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(0);
    expect(checkoutMocks.shipmentCreateCalls).toHaveLength(0);
  });

  test('returns 400 when any item has an unknown productId (mixed cart)', async () => {
    const response = await POST(
      checkoutRequest({
        items: [
          { productId: 'prod_rose', quantity: 1 },
          { productId: 'prod_evil', quantity: 1 },
        ],
        address: validAddress,
      })
    );

    expect(response.status).toBe(400);
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(0);
  });

  test('returns 400 when quantity exceeds the per-line cap of 99', async () => {
    const response = await POST(
      checkoutRequest({
        items: [{ productId: 'prod_rose', quantity: 100 }],
        address: validAddress,
      })
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Invalid line item');
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(0);
  });

  test('returns 400 for non-positive quantities', async () => {
    for (const quantity of [0, -3]) {
      const response = await POST(
        checkoutRequest({
          items: [{ productId: 'prod_rose', quantity }],
          address: validAddress,
        })
      );
      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe('Invalid line item');
    }
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(0);
  });

  test('returns 400 for non-integer quantities', async () => {
    const response = await POST(
      checkoutRequest({
        items: [{ productId: 'prod_rose', quantity: 1.5 }],
        address: validAddress,
      })
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Invalid line item');
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(0);
  });

  test('ignores client-supplied names/prices — they never reach Stripe or ChitChats', async () => {
    const response = await POST(
      checkoutRequest({
        items: [
          // A crafted payload trying to smuggle a 1¢ price through.
          { ...validItems[0], name: 'Ribbon Rose', price: 1 },
        ],
        address: validAddress,
      })
    );

    expect(response.status).toBe(200);
    const params = checkoutMocks.sessionCreateCalls[0] as Record<string, unknown>;
    expect(params.line_items).toEqual([{ price: 'price_rose', quantity: 2 }]);
    const payload = checkoutMocks.shipmentCreateCalls[0] as {
      value: string;
    };
    expect(payload.value).toBe('59.98'); // 2999 * 2 from the catalog
  });
});
