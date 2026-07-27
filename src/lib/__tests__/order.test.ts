import { test, expect, describe } from 'bun:test';
import {
  encodeOrderItems,
  decodeOrderItems,
  generateOrderNumber,
  type OrderLineItem,
} from '@/lib/order';

describe('encodeOrderItems / decodeOrderItems', () => {
  test('round-trips a list of line items', () => {
    const items: OrderLineItem[] = [
      { id: 'blush-romance', name: 'Blush Romance Bouquet', price: 8999, quantity: 1 },
      { id: 'ribbon-rose', name: 'Ribbon Rose', price: 2499, quantity: 2 },
    ];
    const encoded = encodeOrderItems(items);
    const decoded = decodeOrderItems(encoded);
    expect(decoded).toEqual(items);
  });

  test('round-trips a single item', () => {
    const items: OrderLineItem[] = [
      { id: 'x', name: 'X', price: 100, quantity: 1 },
    ];
    expect(decodeOrderItems(encodeOrderItems(items))).toEqual(items);
  });

  test('round-trips an empty array', () => {
    const encoded = encodeOrderItems([]);
    expect(decodeOrderItems(encoded)).toEqual([]);
  });

  test('encoded output is base64url (no +, /, =)', () => {
    const items: OrderLineItem[] = [
      { id: 'a', name: 'a?b/c+d=', price: 1, quantity: 1 },
    ];
    const encoded = encodeOrderItems(items);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  test('round-trips names with non-ASCII characters', () => {
    const items: OrderLineItem[] = [
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