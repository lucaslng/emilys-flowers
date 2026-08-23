// src/lib/__tests__/chitchats.test.ts
//
// Unit tests for the pure ChitChats helpers (no network calls — these are
// isomorphic functions in `src/lib/chitchats.ts`).

import { test, expect, describe } from 'bun:test';
import {
  pickCheapestRate,
  parsePaymentAmountToCents,
  estimateShipmentWeight,
  buildShipmentPayload,
  validateDeliveryAddress,
  CA_PROVINCES,
  type ChitChatsRate,
} from '@/lib/chitchats';
import type { LineItem } from '@/lib/order';

const items: LineItem[] = [
  { id: 'rose', name: 'Ribbon Rose', price: 2999, quantity: 2 },
  { id: 'bouquet', name: 'Blush Romance Bouquet', price: 8999, quantity: 1 },
];

describe('pickCheapestRate', () => {
  test('returns null for an empty rates array', () => {
    expect(pickCheapestRate([])).toBeNull();
  });

  test('picks the rate with the lowest payment_amount', () => {
    const rates: ChitChatsRate[] = [
      { postage_type: 'expedited', postage_description: 'Expedited', payment_amount: '14.50' },
      { postage_type: 'standard', postage_description: 'Standard', payment_amount: '9.68' },
      { postage_type: 'priority', postage_description: 'Priority', payment_amount: '21.00' },
    ];
    expect(pickCheapestRate(rates)).toEqual(rates[1]);
  });

  test('returns the only rate when there is one', () => {
    const rates: ChitChatsRate[] = [
      { postage_type: 'standard', postage_description: 'Standard', payment_amount: '9.68' },
    ];
    expect(pickCheapestRate(rates)).toEqual(rates[0]);
  });

  test('skips rates with a malformed payment_amount', () => {
    const rates: ChitChatsRate[] = [
      { postage_type: 'broken', postage_description: 'Broken', payment_amount: 'not-a-number' },
      { postage_type: 'standard', postage_description: 'Standard', payment_amount: '9.68' },
      { postage_type: 'expedited', postage_description: 'Expedited', payment_amount: '14.50' },
    ];
    expect(pickCheapestRate(rates)).toEqual(rates[1]);
  });

  test('returns null when every payment_amount is malformed or non-positive', () => {
    const rates: ChitChatsRate[] = [
      { postage_type: 'a', postage_description: 'A', payment_amount: 'not-a-number' },
      { postage_type: 'b', postage_description: 'B', payment_amount: '' },
      { postage_type: 'c', postage_description: 'C', payment_amount: '0.00' },
      { postage_type: 'd', postage_description: 'D', payment_amount: '-5.00' },
    ];
    expect(pickCheapestRate(rates)).toBeNull();
  });
});

describe('parsePaymentAmountToCents', () => {
  test('"9.68" -> 968', () => {
    expect(parsePaymentAmountToCents('9.68')).toBe(968);
  });

  test('"0.00" -> 0', () => {
    expect(parsePaymentAmountToCents('0.00')).toBe(0);
  });

  test('malformed input -> 0', () => {
    expect(parsePaymentAmountToCents('not-a-number')).toBe(0);
    expect(parsePaymentAmountToCents('')).toBe(0);
    expect(parsePaymentAmountToCents('$9.68')).toBe(0);
  });

  test('whole dollars -> cents', () => {
    expect(parsePaymentAmountToCents('12')).toBe(1200);
  });
});

describe('estimateShipmentWeight', () => {
  test('base weight only when there are no items', () => {
    expect(estimateShipmentWeight(0)).toBe(500);
  });

  test('adds 250g per item', () => {
    expect(estimateShipmentWeight(1)).toBe(750);
    expect(estimateShipmentWeight(2)).toBe(1000);
    expect(estimateShipmentWeight(3)).toBe(1250);
  });
});

describe('buildShipmentPayload', () => {
  const address = {
    name: 'Ada Lovelace',
    line1: '1 Analytical Way',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M5V 2T6',
  };

  test('maps line items, value, weight, order id, and rate-request fields', () => {
    const payload = buildShipmentPayload({
      address,
      items,
      orderNumber: 'EF-ABC123',
      subtotalCents: 14998,
    });

    expect(payload).toEqual({
      name: 'Ada Lovelace',
      address_1: '1 Analytical Way',
      city: 'Toronto',
      province_code: 'ON',
      postal_code: 'M5V 2T6',
      country_code: 'CA',
      package_contents: 'merchandise',
      value: '149.98',
      value_currency: 'cad',
      order_id: 'EF-ABC123',
      order_store: 'other',
      package_type: 'parcel',
      weight_unit: 'g',
      weight: 1250, // 500g base + 250g × 3 items
      size_unit: 'cm',
      size_x: 30,
      size_y: 20,
      size_z: 10,
      postage_type: 'unknown',
      ship_date: 'today',
      line_items: [
        { quantity: 2, description: 'Ribbon Rose', value_amount: '59.98', currency_code: 'cad' },
        { quantity: 1, description: 'Blush Romance Bouquet', value_amount: '89.99', currency_code: 'cad' },
      ],
    });
  });

  test('formats the declared value from subtotal cents', () => {
    const payload = buildShipmentPayload({
      address,
      items: [{ id: 'rose', name: 'Ribbon Rose', price: 2499, quantity: 1 }],
      orderNumber: 'EF-ABC123',
      subtotalCents: 2499,
    });
    expect(payload.value).toBe('24.99');
  });

  test('includes address_2 only when line2 is non-empty', () => {
    const withLine2 = buildShipmentPayload({
      address: { ...address, line2: 'Apt 4' },
      items,
      orderNumber: 'EF-ABC123',
      subtotalCents: 14998,
    });
    expect(withLine2.address_2).toBe('Apt 4');

    const withoutLine2 = buildShipmentPayload({
      address,
      items,
      orderNumber: 'EF-ABC123',
      subtotalCents: 14998,
    });
    expect(withoutLine2.address_2).toBeUndefined();
  });
});

describe('validateDeliveryAddress', () => {
  test('accepts a valid Canadian address and trims/normalizes it', () => {
    const result = validateDeliveryAddress({
      name: '  Ada Lovelace ',
      line1: ' 1 Analytical Way ',
      city: ' Toronto ',
      province: 'on',
      postalCode: ' M5V 2T6 ',
    });
    expect(result).toEqual({
      ok: true,
      value: {
        name: 'Ada Lovelace',
        line1: '1 Analytical Way',
        line2: '',
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M5V 2T6',
      },
    });
  });

  test('accepts an optional line2 (apartment/unit) and trims it', () => {
    const result = validateDeliveryAddress({
      name: 'Ada Lovelace',
      line1: '1 Analytical Way',
      line2: ' Apt 4 ',
      city: 'Toronto',
      province: 'ON',
      postalCode: 'M5V 2T6',
    });
    expect(result).toEqual({
      ok: true,
      value: {
        name: 'Ada Lovelace',
        line1: '1 Analytical Way',
        line2: 'Apt 4',
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M5V 2T6',
      },
    });
  });

  test('accepts an empty line2 string', () => {
    const result = validateDeliveryAddress({
      name: 'Ada Lovelace',
      line1: '1 Analytical Way',
      line2: '   ',
      city: 'Toronto',
      province: 'ON',
      postalCode: 'M5V 2T6',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.line2).toBe('');
    }
  });

  test('normalizes the postal code to canonical "A1A 1A1" form', () => {
    for (const input of ['m5v2t6', 'M5V-2T6', ' m5v 2t6 ', 'M5V  2T6']) {
      const result = validateDeliveryAddress({
        name: 'Ada Lovelace',
        line1: '1 Analytical Way',
        city: 'Toronto',
        province: 'ON',
        postalCode: input,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.postalCode).toBe('M5V 2T6');
      }
    }
  });

  test('rejects a malformed postal code', () => {
    for (const postalCode of ['12345', 'ABCDEF', 'M5V 2T', 'D5V 2T6']) {
      const result = validateDeliveryAddress({
        name: 'Ada Lovelace',
        line1: '1 Analytical Way',
        city: 'Toronto',
        province: 'ON',
        postalCode,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('postal code');
      }
    }
  });

  test('rejects a missing address', () => {
    expect(validateDeliveryAddress(undefined).ok).toBe(false);
    expect(validateDeliveryAddress(null).ok).toBe(false);
  });

  test('rejects missing fields', () => {
    expect(
      validateDeliveryAddress({
        name: 'Ada Lovelace',
        line1: '1 Analytical Way',
        city: 'Toronto',
        province: 'ON',
      }).ok
    ).toBe(false);
    expect(
      validateDeliveryAddress({
        name: '',
        line1: '1 Analytical Way',
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M5V 2T6',
      }).ok
    ).toBe(false);
  });

  test('rejects a bad province code', () => {
    const result = validateDeliveryAddress({
      name: 'Ada Lovelace',
      line1: '1 Analytical Way',
      city: 'Toronto',
      province: 'XX',
      postalCode: 'M5V 2T6',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('XX');
    }
  });

  test('CA_PROVINCES contains all 13 provinces and territories', () => {
    expect(CA_PROVINCES).toEqual([
      'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
    ]);
  });
});