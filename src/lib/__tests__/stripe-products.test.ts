// bun runs each test file in its own process, so this per-file `stripe` mock doesn't collide with ./order-emails-mocks.ts.

import { test, expect, describe, beforeEach, mock } from 'bun:test';
import type Stripe from 'stripe';

const stripeMocks = {
  listCalls: [] as Array<Record<string, unknown>>,
  pages: [] as Array<{ data: Stripe.Product[]; has_more: boolean }>,
};

function makeProduct(
  id: string,
  overrides: Partial<Stripe.Product> = {}
): Stripe.Product {
  return {
    id,
    name: `Product ${id}`,
    active: true,
    default_price: { id: `price_${id}`, unit_amount: 1999 },
    ...overrides,
  } as Stripe.Product;
}

mock.module('stripe', () => {
  class MockStripe {
    static createFetchHttpClient() {
      return {};
    }
    products = {
      list: async (params: Record<string, unknown>) => {
        stripeMocks.listCalls.push(params);
        const page = stripeMocks.pages[stripeMocks.listCalls.length - 1];
        return page ?? { data: [], has_more: false };
      },
    };
  }
  return { default: MockStripe };
});

const { listActiveProducts } = await import('@/lib/stripe-products');
const { default: MockStripe } = await import('stripe');

function captureWarnings(): { warnings: string[]; restore: () => void } {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '));
  };
  return {
    warnings,
    restore: () => {
      console.warn = original;
    },
  };
}

describe('listActiveProducts', () => {
  beforeEach(() => {
    stripeMocks.listCalls.length = 0;
    stripeMocks.pages.length = 0;
  });

  test('sends the shared query params on every page', async () => {
    stripeMocks.pages = [
      { data: [makeProduct('prod_1')], has_more: false },
    ];
    const stripe = new MockStripe('sk_test_mock') as unknown as Stripe;
    await listActiveProducts(stripe, 'test-source');

    expect(stripeMocks.listCalls.length).toBe(1);
    expect(stripeMocks.listCalls[0]).toEqual({
      limit: 100,
      expand: ['data.default_price'],
      active: true,
    });
  });

  test('follows starting_after cursors across multiple pages', async () => {
    stripeMocks.pages = [
      {
        data: [makeProduct('prod_1'), makeProduct('prod_2')],
        has_more: true,
      },
      {
        data: [makeProduct('prod_3'), makeProduct('prod_4')],
        has_more: true,
      },
      { data: [makeProduct('prod_5')], has_more: false },
    ];
    const stripe = new MockStripe('sk_test_mock') as unknown as Stripe;
    const products = await listActiveProducts(stripe, 'test-source');

    expect(products.map((p) => p.id)).toEqual([
      'prod_1',
      'prod_2',
      'prod_3',
      'prod_4',
      'prod_5',
    ]);
    expect(stripeMocks.listCalls.length).toBe(3);
    expect(stripeMocks.listCalls[0].starting_after).toBeUndefined();
    expect(stripeMocks.listCalls[1].starting_after).toBe('prod_2');
    expect(stripeMocks.listCalls[2].starting_after).toBe('prod_4');
  });

  test('terminates cleanly when the final page is empty', async () => {
    stripeMocks.pages = [
      { data: [makeProduct('prod_1'), makeProduct('prod_2')], has_more: true },
      { data: [], has_more: false },
    ];
    const stripe = new MockStripe('sk_test_mock') as unknown as Stripe;
    const products = await listActiveProducts(stripe, 'test-source');

    expect(products.map((p) => p.id)).toEqual(['prod_1', 'prod_2']);
    expect(stripeMocks.listCalls.length).toBe(2);
  });

  test('skips products without a usable default price and warns', async () => {
    stripeMocks.pages = [
      {
        data: [
          makeProduct('prod_ok'),
          makeProduct('prod_no_price', { default_price: null }),
          makeProduct('prod_null_amount', {
            default_price: { id: 'price_x', unit_amount: null } as Stripe.Price,
          }),
          makeProduct('prod_no_price_id', {
            default_price: { unit_amount: 499 } as Stripe.Price,
          }),
        ],
        has_more: false,
      },
    ];
    const stripe = new MockStripe('sk_test_mock') as unknown as Stripe;
    const captured = captureWarnings();
    try {
      const products = await listActiveProducts(stripe, 'test-source');
      expect(products.map((p) => p.id)).toEqual(['prod_ok']);
      expect(captured.warnings.length).toBe(3);
      expect(captured.warnings[0]).toContain(
        '[test-source] Skipping "Product prod_no_price" (prod_no_price): no usable default price.'
      );
    } finally {
      captured.restore();
    }
  });
});
