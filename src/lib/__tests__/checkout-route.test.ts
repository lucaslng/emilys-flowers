// bun runs each test file in its own process, so these per-file mocks don't collide with ./order-emails-mocks.ts.
// @/lib/chitchats is mocked with the REAL pure helpers spread in; only isChitchatsConfigured/createShipment are overridden,
// so the route's pure logic (rate picking, payload building, address validation) still runs for real.

import { test, expect, describe, beforeEach, mock } from 'bun:test';
import type { ChitChatsShipment } from '@/lib/chitchats';
import { ADDRESS_FIELD_MAX_LENGTHS } from '@/lib/address-validation';
import {
  rateLimitMocks,
  resetRateLimitMocks,
} from './rate-limit-mocks';

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

// Stripe product ids; prices/names resolve from here, never from the request.
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

// The wire shape: product references + quantities ONLY — client-supplied names/prices must never be trusted.
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
    resetRateLimitMocks();
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

    // Catalog-resolved Price objects, never inline price_data built from client-supplied values.
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
    // The address is collected on our own checkout page — Stripe must not ask for a second one.
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

    // Success URLs carry only the session id placeholder.
    const successUrl = params.success_url as string;
    expect(successUrl).toContain('&session_id={CHECKOUT_SESSION_ID}');
    expect(successUrl).not.toContain('&items=');
    expect(successUrl).not.toContain('&shipping=');
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

    // Declared customs/insurance value comes from the catalog subtotal (2999*2 + 8999*1 = 14997 cents).
    expect(payload.value).toBe('149.97');
    expect(payload.line_items).toEqual([
      {
        description: 'Ribbon Rose - handmade decorative ribbon flower arrangement',
        value_amount: '59.98',
        quantity: 2,
        currency_code: 'cad',
      },
      {
        description: 'Blush Romance Bouquet - handmade decorative ribbon flower arrangement',
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
    expect(params.success_url).not.toContain('&shipping=');
  });

  test('charges the cheapest valid rate\'s strict cents when an unparseable rate must be skipped', async () => {
    checkoutMocks.shipment.rates = [
      {
        postage_type: 'expedited',
        postage_description: 'Expedited Parcel',
        payment_amount: '14.50',
      },
      {
        postage_type: 'broken',
        postage_description: 'Broken',
        payment_amount: 'oops',
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
    // The Stripe amount is the strict parse of the CHOSEN rate's payment_amount — never a NaN→0 fallback re-parse.
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
  });

  test('truncates over-long address fields in BOTH the ChitChats payload and the shipping_address metadata', async () => {
    const overLongAddress = {
      name: 'N'.repeat(500),
      line1: 'L'.repeat(500),
      line2: 'A'.repeat(500),
      city: 'C'.repeat(500),
      province: 'ON',
      postalCode: 'M5V 2T6',
    };

    const response = await POST(
      checkoutRequest({ items: validItems, address: overLongAddress })
    );

    expect(response.status).toBe(200);
    expect(checkoutMocks.shipmentCreateCalls).toHaveLength(1);
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(1);

    const payload = checkoutMocks.shipmentCreateCalls[0] as {
      name: string;
      address_1: string;
      address_2: string;
      city: string;
    };
    const params = checkoutMocks.sessionCreateCalls[0] as Record<string, unknown>;
    const metadata = params.metadata as Record<string, string>;
    const stored = JSON.parse(metadata.shipping_address) as Record<
      string,
      string
    >;

    expect(payload.name).toBe(stored.name);
    expect(payload.address_1).toBe(stored.line1);
    expect(payload.address_2).toBe(stored.line2);
    expect(payload.city).toBe(stored.city);

    for (const [field, value] of Object.entries(stored)) {
      expect(value.length).toBeLessThanOrEqual(
        ADDRESS_FIELD_MAX_LENGTHS[field as keyof typeof ADDRESS_FIELD_MAX_LENGTHS]
      );
    }
    expect(metadata.shipping_address.length).toBeLessThanOrEqual(500);
  });

  test('pathological escape inflation: the ChitChats payload derives from the SAME serialized value as the metadata', async () => {
    // Quote-heavy fields force the fallback (drop line2, then shorten); the payload must come from the parsed-back stored value.
    const quoteHeavyAddress = {
      name: '"'.repeat(200),
      line1: '"'.repeat(200),
      line2: '"'.repeat(200),
      city: '"'.repeat(200),
      province: 'ON',
      postalCode: 'M5V 2T6',
    };

    const response = await POST(
      checkoutRequest({ items: validItems, address: quoteHeavyAddress })
    );

    expect(response.status).toBe(200);
    expect(checkoutMocks.shipmentCreateCalls).toHaveLength(1);
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(1);

    const payload = checkoutMocks.shipmentCreateCalls[0] as {
      name: string;
      address_1: string;
      address_2?: string;
      city: string;
    };
    const params = checkoutMocks.sessionCreateCalls[0] as Record<string, unknown>;
    const metadata = params.metadata as Record<string, string>;
    expect(metadata.shipping_address.length).toBeLessThanOrEqual(500);

    const stored = JSON.parse(metadata.shipping_address) as Record<
      string,
      string
    >;
    expect(payload.name).toBe(stored.name);
    expect(payload.address_1).toBe(stored.line1);
    expect('line2' in stored).toBe(false);
    expect(payload.address_2).toBeUndefined();
    expect(payload.city).toBe(stored.city);
  });

  test('returns 400 with per-field errors when the address is missing', async () => {
    const response = await POST(checkoutRequest({ items: validItems }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'A delivery address is required to calculate shipping.',
      fieldErrors: [
        { field: 'name', message: 'Enter your full name' },
        { field: 'line1', message: 'Enter your street address' },
        { field: 'city', message: 'Enter your city' },
        { field: 'province', message: 'Select a province' },
        {
          field: 'postalCode',
          message: 'Enter a valid Canadian postal code (e.g. M5V 2T6)',
        },
      ],
    });
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(0);
  });

  test('returns 400 with a structured province error when the address is invalid', async () => {
    const response = await POST(
      checkoutRequest({
        items: validItems,
        address: { ...validAddress, province: 'XX' },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'A delivery address is required to calculate shipping.',
      fieldErrors: [
        {
          field: 'province',
          message:
            'Invalid province code "XX". Must be one of: AB, BC, MB, NB, NL, NS, NT, NU, ON, PE, QC, SK, YT.',
        },
      ],
    });
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(0);
  });

  test('returns 400 with a structured postal-code error when the postal code is malformed', async () => {
    const response = await POST(
      checkoutRequest({
        items: validItems,
        address: { ...validAddress, postalCode: '12345' },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'A delivery address is required to calculate shipping.',
      fieldErrors: [
        {
          field: 'postalCode',
          message: 'Enter a valid Canadian postal code (e.g. M5V 2T6)',
        },
      ],
    });
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(0);
  });

  test('returns every per-field error in form order from the single validation pass', async () => {
    const response = await POST(
      checkoutRequest({
        items: validItems,
        address: {
          name: '',
          line1: '1 Analytical Way',
          city: '',
          province: 'XX',
          postalCode: '12345',
        },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'A delivery address is required to calculate shipping.',
      fieldErrors: [
        { field: 'name', message: 'Enter your full name' },
        { field: 'city', message: 'Enter your city' },
        {
          field: 'province',
          message:
            'Invalid province code "XX". Must be one of: AB, BC, MB, NB, NL, NS, NT, NU, ON, PE, QC, SK, YT.',
        },
        {
          field: 'postalCode',
          message: 'Enter a valid Canadian postal code (e.g. M5V 2T6)',
        },
      ],
    });
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(0);
    expect(checkoutMocks.shipmentCreateCalls).toHaveLength(0);
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

    // No address required when shipping rates are unavailable.
    const response = await POST(checkoutRequest({ items: validItems }));

    expect(response.status).toBe(200);
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(1);
    const params = checkoutMocks.sessionCreateCalls[0] as Record<string, unknown>;
    expect(params.shipping_options).toBeUndefined();
    expect(params.shipping_address_collection).toBeUndefined();
    expect(params.billing_address_collection).toBe('required');
    expect(params.success_url).not.toContain('&shipping=');
  });

  test('returns 503 when STRIPE_SECRET_KEY is absent', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const response = await POST(checkoutRequest({ items: validItems }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Stripe is not configured.',
    });
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(0);
    expect(checkoutMocks.shipmentCreateCalls).toHaveLength(0);
  });

  // --- Redirect origin pinning ---

  test('derives success/cancel URLs from BASE_URL when set', async () => {
    const env = process.env as Record<string, string | undefined>;
    const savedBaseUrl = env.BASE_URL;
    env.BASE_URL = 'https://emilysflowers.ca/';
    try {
      await POST(checkoutRequest({ items: validItems, address: validAddress }));

      expect(checkoutMocks.sessionCreateCalls).toHaveLength(1);
      const params = checkoutMocks.sessionCreateCalls[0] as Record<
        string,
        unknown
      >;
      expect(params.success_url).toMatch(
        /^https:\/\/emilysflowers\.ca\/checkout\/success\?order=EF-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}&session_id=\{CHECKOUT_SESSION_ID\}$/
      );
      expect(params.cancel_url).toBe('https://emilysflowers.ca/cart?canceled=true');
    } finally {
      if (savedBaseUrl === undefined) delete env.BASE_URL;
      else env.BASE_URL = savedBaseUrl;
    }
  });

  test('falls back to the request origin when BASE_URL is unset outside production', async () => {
    const env = process.env as Record<string, string | undefined>;
    const savedBaseUrl = env.BASE_URL;
    const savedNodeEnv = env.NODE_ENV;
    delete env.BASE_URL;
    env.NODE_ENV = 'development';
    try {
      await POST(checkoutRequest({ items: validItems, address: validAddress }));

      expect(checkoutMocks.sessionCreateCalls).toHaveLength(1);
      const params = checkoutMocks.sessionCreateCalls[0] as Record<
        string,
        unknown
      >;
      expect(params.success_url).toMatch(
        /^http:\/\/localhost\/checkout\/success\?order=/
      );
      expect(params.cancel_url).toBe('http://localhost/cart?canceled=true');
    } finally {
      if (savedBaseUrl === undefined) delete env.BASE_URL;
      else env.BASE_URL = savedBaseUrl;
      if (savedNodeEnv === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = savedNodeEnv;
    }
  });

  test('returns 503 without any external call when BASE_URL is missing in production', async () => {
    const env = process.env as Record<string, string | undefined>;
    const savedBaseUrl = env.BASE_URL;
    const savedNodeEnv = env.NODE_ENV;
    delete env.BASE_URL;
    env.NODE_ENV = 'production';
    try {
      const response = await POST(
        checkoutRequest({ items: validItems, address: validAddress })
      );

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: 'Checkout is not configured.',
      });
      // Fails closed before rate limiting, ChitChats, and Stripe.
      expect(checkoutMocks.shipmentCreateCalls).toHaveLength(0);
      expect(checkoutMocks.sessionCreateCalls).toHaveLength(0);
    } finally {
      if (savedBaseUrl === undefined) delete env.BASE_URL;
      else env.BASE_URL = savedBaseUrl;
      if (savedNodeEnv === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = savedNodeEnv;
    }
  });

  // --- Catalog-membership rejections ---

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

  test('merges duplicate productIds into ONE Stripe line_item with the summed quantity', async () => {
    const response = await POST(
      checkoutRequest({
        items: [
          { productId: 'prod_rose', quantity: 2 },
          { productId: 'prod_bouquet', quantity: 1 },
          { productId: 'prod_rose', quantity: 3 },
        ],
        address: validAddress,
      })
    );

    expect(response.status).toBe(200);
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(1);
    const params = checkoutMocks.sessionCreateCalls[0] as Record<string, unknown>;

    expect(params.line_items).toEqual([
      { price: 'price_rose', quantity: 5 },
      { price: 'price_bouquet', quantity: 1 },
    ]);
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

  // --- Rate limiting ---

  test('consults the limiter with a checkout-prefixed key before any billable call', async () => {
    const request = new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '203.0.113.7',
      },
      body: JSON.stringify({ items: validItems, address: validAddress }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(rateLimitMocks.limitCalls).toEqual(['checkout:203.0.113.7']);
    expect(checkoutMocks.shipmentCreateCalls).toHaveLength(1);
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(1);
  });

  test('returns 429 without creating a shipment or Stripe session when rate-limited', async () => {
    rateLimitMocks.limitSuccess = false;

    const response = await POST(
      checkoutRequest({ items: validItems, address: validAddress })
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect((await response.json()).error).toBe('Too many requests');
    expect(checkoutMocks.shipmentCreateCalls).toHaveLength(0);
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(0);
  });

  test('shape-invalid payloads are rejected before the limiter is consulted (quota-free)', async () => {
    const response = await POST(
      checkoutRequest({ items: [{ productId: 'prod_rose', quantity: 100 }] })
    );

    expect(response.status).toBe(400);
    expect(rateLimitMocks.limitCalls).toHaveLength(0);
    expect(checkoutMocks.shipmentCreateCalls).toHaveLength(0);
  });

  test('returns 400 (not 500) for a malformed JSON body', async () => {
    const request = new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid request body.' });
    expect(checkoutMocks.sessionCreateCalls).toHaveLength(0);
    expect(checkoutMocks.shipmentCreateCalls).toHaveLength(0);
  });
});
