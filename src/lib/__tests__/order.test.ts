import { test, expect, describe } from 'bun:test';
import {
  generateOrderNumber,
  computeLineItemTotal,
  computeLineItemCount,
  computeShipping,
  validateCheckoutItems,
  MAX_LINE_ITEM_QUANTITY,
  type LineItem,
} from '@/lib/order';

describe('generateOrderNumber', () => {
  test('produces EF-XXXXXX format', () => {
    expect(generateOrderNumber()).toMatch(/^EF-[A-Z0-9]{6}$/);
  });

  test('excludes ambiguous characters (I, O, 0, 1, L)', () => {
    for (let i = 0; i < 500; i++) {
      const n = generateOrderNumber();
      expect(n).not.toContain('I');
      expect(n).not.toContain('O');
      expect(n).not.toContain('0');
      expect(n).not.toContain('1');
      expect(n).not.toContain('L');
    }
  });

  test('produces unique values across many calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      seen.add(generateOrderNumber());
    }
    // 30^6 space; 1000 draws should not collide meaningfully.
    expect(seen.size).toBeGreaterThan(990);
  });
});

describe('computeLineItemTotal', () => {
  test('empty -> 0', () => {
    expect(computeLineItemTotal([])).toBe(0);
  });

  test('single item, quantity 1 -> price', () => {
    const items: LineItem[] = [{ id: 'test-rose', name: 'Test Rose', price: 2499, quantity: 1 }];
    expect(computeLineItemTotal(items)).toBe(2499);
  });

  test('single item, quantity 3 -> price * 3', () => {
    const items: LineItem[] = [{ id: 'test-rose', name: 'Test Rose', price: 2499, quantity: 3 }];
    expect(computeLineItemTotal(items)).toBe(7497);
  });

  test('two different items -> sum of (price * quantity)', () => {
    const items: LineItem[] = [
      { id: 'test-rose', name: 'Test Rose', price: 2499, quantity: 2 },
      { id: 'test-peony', name: 'Test Peony', price: 2999, quantity: 3 },
    ];
    // 2499*2 + 2999*3 = 4998 + 8997 = 13995
    expect(computeLineItemTotal(items)).toBe(13995);
  });
});

describe('computeLineItemCount', () => {
  test('empty -> 0', () => {
    expect(computeLineItemCount([])).toBe(0);
  });

  test('single item, quantity 1 -> 1', () => {
    const items: LineItem[] = [{ id: 'x', name: 'X', price: 100, quantity: 1 }];
    expect(computeLineItemCount(items)).toBe(1);
  });

  test('two items, quantities 2 + 3 -> 5', () => {
    const items: LineItem[] = [
      { id: 'a', name: 'A', price: 100, quantity: 2 },
      { id: 'b', name: 'B', price: 100, quantity: 3 },
    ];
    expect(computeLineItemCount(items)).toBe(5);
  });
});

describe('computeShipping', () => {
  test('0 cents -> 599 (flat shipping)', () => {
    expect(computeShipping(0)).toBe(599);
  });

  test('4999 cents (just under $50) -> 599', () => {
    expect(computeShipping(4999)).toBe(599);
  });

  test('5000 cents (exactly $50) -> 0 (free shipping threshold)', () => {
    expect(computeShipping(5000)).toBe(0);
  });

  test('5001 cents (just over $50) -> 0', () => {
    expect(computeShipping(5001)).toBe(0);
  });

  test('14999 cents -> 0', () => {
    expect(computeShipping(14999)).toBe(0);
  });
});

describe('validateCheckoutItems ({productId, quantity} wire shape)', () => {
  test('valid single item -> ok', () => {
    expect(
      validateCheckoutItems([{ productId: 'prod_rose', quantity: 2 }])
    ).toEqual({ ok: true });
  });

  test('valid multiple items -> ok', () => {
    expect(
      validateCheckoutItems([
        { productId: 'prod_rose', quantity: 2 },
        { productId: 'prod_bouquet', quantity: 1 },
      ])
    ).toEqual({ ok: true });
  });

  test('empty array -> No items provided', () => {
    expect(validateCheckoutItems([])).toEqual({
      ok: false,
      error: 'No items provided',
    });
  });

  test('undefined / null / non-array -> No items provided', () => {
    for (const bad of [undefined, null, 'items', {}, 42]) {
      expect(validateCheckoutItems(bad)).toEqual({
        ok: false,
        error: 'No items provided',
      });
    }
  });

  test('missing productId -> Invalid line item', () => {
    expect(validateCheckoutItems([{ quantity: 1 }])).toEqual({
      ok: false,
      error: 'Invalid line item',
    });
  });

  test('empty / whitespace productId -> Invalid line item', () => {
    for (const productId of ['', '   ']) {
      expect(validateCheckoutItems([{ productId, quantity: 1 }])).toEqual({
        ok: false,
        error: 'Invalid line item',
      });
    }
  });

  test('non-string productId -> Invalid line item', () => {
    expect(validateCheckoutItems([{ productId: 42, quantity: 1 }])).toEqual({
      ok: false,
      error: 'Invalid line item',
    });
  });

  test('zero / negative quantity -> Invalid line item', () => {
    for (const quantity of [0, -1]) {
      expect(
        validateCheckoutItems([{ productId: 'prod_rose', quantity }])
      ).toEqual({ ok: false, error: 'Invalid line item' });
    }
  });

  test('non-integer quantity -> Invalid line item', () => {
    for (const quantity of [1.5, NaN, Infinity]) {
      expect(
        validateCheckoutItems([{ productId: 'prod_rose', quantity }])
      ).toEqual({ ok: false, error: 'Invalid line item' });
    }
  });

  test(`quantity ${MAX_LINE_ITEM_QUANTITY} -> ok; ${MAX_LINE_ITEM_QUANTITY + 1} -> Invalid line item`, () => {
    expect(
      validateCheckoutItems([
        { productId: 'prod_rose', quantity: MAX_LINE_ITEM_QUANTITY },
      ])
    ).toEqual({ ok: true });
    expect(
      validateCheckoutItems([
        { productId: 'prod_rose', quantity: MAX_LINE_ITEM_QUANTITY + 1 },
      ])
    ).toEqual({ ok: false, error: 'Invalid line item' });
  });

  test('null item in array -> Invalid line item', () => {
    expect(validateCheckoutItems([null])).toEqual({
      ok: false,
      error: 'Invalid line item',
    });
  });

  test('extra fields (name/price smuggling) are tolerated by validation but carry no weight', () => {
    // Validation passes — the route simply never reads name/price from the
    // request; resolution happens against the Stripe catalog.
    expect(
      validateCheckoutItems([
        { productId: 'prod_rose', quantity: 2, name: 'Ribbon Rose', price: 1 },
      ])
    ).toEqual({ ok: true });
  });
});