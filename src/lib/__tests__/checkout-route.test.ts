// src/lib/__tests__/checkout-route.test.ts
//
// Tests for `POST /api/checkout` with ChitChats shipping configured.
//
// bun runs each test file in its own process, so the `stripe` and
// `@/lib/chitchats` mocks registered here are per-file and don't collide with
// the process-global mocks in `./order-emails-mocks.ts` (webhook/ship tests).
//
// `@/lib/chitchats` is mocked with the REAL pure helpers (spread from the
// pre-imported module) and only `isChitchatsConfigured` / `createShipment`
// overridden — the route's pure logic (rate picking, payload building,
// address validation) still runs for real.

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
};

mock.module('@/lib/chitchats', () => ({
  ...realChitchats,
  isChitchatsConfigured: () => checkoutMocks.chitchatsConfigured,
  createShipment: async () => {
    if (checkoutMocks.shipmentShouldThrow) {
      throw new Error('ChitChats API error (500): boom');
    }
    return checkoutMocks.shipment;
  },
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

const validItems = [
  { id: 'rose', name: 'Ribbon Rose', price: 2999, quantity: 2 },
  { id: 'bouquet', name: 'Blush Romance Bouquet', price: 8999, quantity: 1 },
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
  });

  test('creates a session with the cheapest ChitChats rate as the shipping option', async () => {
    const response = await POST(
      checkoutRequest({ items: validItems, address: validAddress })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    });

    expect(checkoutMocks.sessionCreateCalls).toHaveLength(1);
    const params = checkoutMocks.sessionCreateCalls[0] as Record<string, unknown>;

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

    const successUrl = params.success_url as string;
    expect(successUrl).toContain('&shipping=968');
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

  test('simulates success when STRIPE_SECRET_KEY is absent', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const response = await POST(checkoutRequest({ items: validItems }));

    expect(response.status).toBe(200);
    const json = (await response.json()) as { url: string };
    expect(json.url).toContain('/checkout/success?success=true&order=EF-');
    expect(json.url).toContain('&items=');
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(0);
  });
});