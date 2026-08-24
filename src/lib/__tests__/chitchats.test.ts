import { test, expect, describe } from 'bun:test';
import {
  pickCheapestRate,
  estimateShipmentWeight,
  buildShipmentPayload,
  validateDeliveryAddress,
  isValidShipmentId,
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

  test('picks the rate with the lowest payment_amount, with strict cents', () => {
    const rates: ChitChatsRate[] = [
      { postage_type: 'expedited', postage_description: 'Expedited', payment_amount: '14.50' },
      { postage_type: 'standard', postage_description: 'Standard', payment_amount: '9.68' },
      { postage_type: 'priority', postage_description: 'Priority', payment_amount: '21.00' },
    ];
    expect(pickCheapestRate(rates)).toEqual({ rate: rates[1], cents: 968 });
  });

  test('returns the only rate when there is one', () => {
    const rates: ChitChatsRate[] = [
      { postage_type: 'standard', postage_description: 'Standard', payment_amount: '9.68' },
    ];
    expect(pickCheapestRate(rates)).toEqual({ rate: rates[0], cents: 968 });
  });

  test('skips rates with a malformed payment_amount', () => {
    const rates: ChitChatsRate[] = [
      { postage_type: 'broken', postage_description: 'Broken', payment_amount: 'not-a-number' },
      { postage_type: 'standard', postage_description: 'Standard', payment_amount: '9.68' },
      { postage_type: 'expedited', postage_description: 'Expedited', payment_amount: '14.50' },
    ];
    expect(pickCheapestRate(rates)).toEqual({ rate: rates[1], cents: 968 });
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

  test('strict cents: whole dollars and never a NaN→0 fallback', () => {
    const rates: ChitChatsRate[] = [
      { postage_type: 'broken', postage_description: 'Broken', payment_amount: '$9.68' },
      { postage_type: 'standard', postage_description: 'Standard', payment_amount: '12' },
    ];
    expect(pickCheapestRate(rates)).toEqual({ rate: rates[1], cents: 1200 });
  });
});

describe('estimateShipmentWeight', () => {
  test('zero when there are no items (no base weight)', () => {
    expect(estimateShipmentWeight(0)).toBe(0);
  });

  test('adds 250g per item', () => {
    expect(estimateShipmentWeight(1)).toBe(250);
    expect(estimateShipmentWeight(2)).toBe(500);
    expect(estimateShipmentWeight(3)).toBe(750);
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
      description:
        "Handmade decorative ribbon flowers and bouquets (artificial floral crafts, no live plants) - Emily's Flowers order EF-ABC123",
      value: '149.98',
      value_currency: 'cad',
      order_id: 'EF-ABC123',
      order_store: 'other',
      package_type: 'parcel',
      weight_unit: 'g',
      weight: 750, // 250g × 3 items
      size_unit: 'cm',
      size_x: 30,
      size_y: 20,
      size_z: 10,
      postage_type: 'unknown',
      ship_date: 'today',
      line_items: [
        {
          quantity: 2,
          description: 'Ribbon Rose - handmade decorative ribbon flower arrangement',
          value_amount: '59.98',
          currency_code: 'cad',
        },
        {
          quantity: 1,
          description: 'Blush Romance Bouquet - handmade decorative ribbon flower arrangement',
          value_amount: '89.99',
          currency_code: 'cad',
        },
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

describe('isValidShipmentId', () => {
  test('accepts well-formed ChitChats shipment ids', () => {
    expect(isValidShipmentId('123456')).toBe(true);
    expect(isValidShipmentId('SHIP-1234')).toBe(true);
    expect(isValidShipmentId('ab_cd-12')).toBe(true);
    expect(isValidShipmentId('abcd')).toBe(true); // 4-char lower bound
    expect(isValidShipmentId('a'.repeat(64))).toBe(true); // 64-char upper bound
  });

  test('rejects malformed ids', () => {
    expect(isValidShipmentId('javascript:alert(1)')).toBe(false);
    expect(isValidShipmentId('https://evil.example')).toBe(false);
    expect(isValidShipmentId('')).toBe(false);
    expect(isValidShipmentId('abc')).toBe(false); // too short (< 4)
    expect(isValidShipmentId('a'.repeat(65))).toBe(false); // too long (> 64)
    expect(isValidShipmentId('has space')).toBe(false);
    expect(isValidShipmentId('../../etc')).toBe(false);
    expect(isValidShipmentId('<script>')).toBe(false);
    expect(isValidShipmentId("id';--")).toBe(false);
    expect(isValidShipmentId('café')).toBe(false);
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
      address: {
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
      address: {
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
      expect(result.address.line2).toBe('');
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
        expect(result.address.postalCode).toBe('M5V 2T6');
      }
    }
  });

  test('rejects a malformed postal code with a per-field error', () => {
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
        expect(result.fieldErrors).toEqual([
          {
            field: 'postalCode',
            message: 'Enter a valid Canadian postal code (e.g. M5V 2T6)',
          },
        ]);
      }
    }
  });

  test('rejects a missing address with all required-field errors', () => {
    for (const address of [undefined, null]) {
      const result = validateDeliveryAddress(address);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.fieldErrors.map((error) => error.field)).toEqual([
          'name',
          'line1',
          'city',
          'province',
          'postalCode',
        ]);
      }
    }
  });

  test('rejects missing fields with a per-field error each', () => {
    const missingPostal = validateDeliveryAddress({
      name: 'Ada Lovelace',
      line1: '1 Analytical Way',
      city: 'Toronto',
      province: 'ON',
    });
    expect(missingPostal.ok).toBe(false);
    if (!missingPostal.ok) {
      expect(missingPostal.fieldErrors).toEqual([
        {
          field: 'postalCode',
          message: 'Enter a valid Canadian postal code (e.g. M5V 2T6)',
        },
      ]);
    }

    const blankName = validateDeliveryAddress({
      name: '',
      line1: '1 Analytical Way',
      city: 'Toronto',
      province: 'ON',
      postalCode: 'M5V 2T6',
    });
    expect(blankName.ok).toBe(false);
    if (!blankName.ok) {
      expect(blankName.fieldErrors).toEqual([
        { field: 'name', message: 'Enter your full name' },
      ]);
    }
  });

  test('rejects a bad province code with a per-field error', () => {
    const result = validateDeliveryAddress({
      name: 'Ada Lovelace',
      line1: '1 Analytical Way',
      city: 'Toronto',
      province: 'XX',
      postalCode: 'M5V 2T6',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors).toHaveLength(1);
      expect(result.fieldErrors[0].field).toBe('province');
      expect(result.fieldErrors[0].message).toContain('XX');
    }
  });

  test('CA_PROVINCES contains all 13 provinces and territories', () => {
    expect(CA_PROVINCES).toEqual([
      'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
    ]);
  });
});