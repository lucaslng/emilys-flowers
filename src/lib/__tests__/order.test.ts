import { test, expect, describe } from 'bun:test';
import {
  encodeOrderItems,
  decodeOrderItems,
  generateOrderNumber,
  computeLineItemTotal,
  computeLineItemCount,
  computeShipping,
  type LineItem,
} from '@/lib/order';

describe('encodeOrderItems / decodeOrderItems', () => {
  test('round-trips a list of line items', () => {
    const items: LineItem[] = [
      { id: 'blush-romance', name: 'Blush Romance Bouquet', price: 8999, quantity: 1 },
      { id: 'ribbon-rose', name: 'Ribbon Rose', price: 2499, quantity: 2 },
    ];
    const encoded = encodeOrderItems(items);
    const decoded = decodeOrderItems(encoded);
    expect(decoded).toEqual(items);
  });

  test('round-trips a single item', () => {
    const items: LineItem[] = [
      { id: 'x', name: 'X', price: 100, quantity: 1 },
    ];
    expect(decodeOrderItems(encodeOrderItems(items))).toEqual(items);
  });

  test('round-trips an empty array', () => {
    const encoded = encodeOrderItems([]);
    expect(decodeOrderItems(encoded)).toEqual([]);
  });

  test('encoded output is base64url (no +, /, =)', () => {
    const items: LineItem[] = [
      { id: 'a', name: 'a?b/c+d=', price: 1, quantity: 1 },
    ];
    const encoded = encodeOrderItems(items);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  test('round-trips names with non-ASCII characters', () => {
    const items: LineItem[] = [
      { id: 'p', name: 'Fleur d’amour — café', price: 1999, quantity: 3 },
    ];
    expect(decodeOrderItems(encodeOrderItems(items))).toEqual(items);
  });

  test('returns [] for empty input', () => {
    expect(decodeOrderItems('')).toEqual([]);
  });

  test('returns [] for malformed base64', () => {
    expect(decodeOrderItems('not-valid-base64!!!')).toEqual([]);
  });

  test('returns [] for valid base64 of non-array JSON', () => {
    const b64 = btoa(unescape(encodeURIComponent('"hello"')));
    expect(decodeOrderItems(b64)).toEqual([]);
  });

  test('returns [] for valid base64 of a JSON object', () => {
    const b64 = btoa(unescape(encodeURIComponent('{"id":"x"}')));
    expect(decodeOrderItems(b64)).toEqual([]);
  });

  test('filters out items with wrong shape, keeps valid ones', () => {
    const payload = JSON.stringify([
      { id: 'ok', name: 'Ok', price: 100, quantity: 1 },
      { id: 'no-price', name: 'NoPrice', quantity: 1 },
      'not-an-object',
      null,
      { id: 'bad-name', name: 42, price: 100, quantity: 1 },
    ]);
    const b64 = btoa(unescape(encodeURIComponent(payload)));
    const decoded = decodeOrderItems(b64);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].id).toBe('ok');
  });
});

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