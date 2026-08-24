// Unit tests for the shared shipping-address lib (`src/lib/shipping-address.ts`):
// metadata parsing guards and the separator-parameterized formatter that both
// the webhook (newline + country) and the admin page (comma) render through.

import { test, expect, describe } from 'bun:test';
import {
  formatMetadataShippingAddress,
  parseMetadataShippingAddress,
} from '@/lib/shipping-address';

const stored = {
  name: 'Ada Lovelace',
  line1: '1 Analytical Way',
  line2: 'Apt 4',
  city: 'Toronto',
  province: 'ON',
  postalCode: 'M5V 2T6',
};

function metadataWith(address: unknown): Record<string, string> {
  return { shipping_address: JSON.stringify(address) };
}

describe('parseMetadataShippingAddress', () => {
  test('parses a stored address', () => {
    expect(parseMetadataShippingAddress(metadataWith(stored))).toEqual(stored);
  });

  test('returns null when the key is absent', () => {
    expect(parseMetadataShippingAddress(undefined)).toBeNull();
    expect(parseMetadataShippingAddress(null)).toBeNull();
    expect(parseMetadataShippingAddress({})).toBeNull();
  });

  test('returns null for unparseable JSON', () => {
    expect(
      parseMetadataShippingAddress({ shipping_address: '{not json' })
    ).toBeNull();
  });

  test('returns null for non-object JSON', () => {
    expect(
      parseMetadataShippingAddress({ shipping_address: '"just a string"' })
    ).toBeNull();
    expect(
      parseMetadataShippingAddress({ shipping_address: '42' })
    ).toBeNull();
  });

  test('coerces non-string fields to empty strings', () => {
    expect(
      parseMetadataShippingAddress(
        metadataWith({ ...stored, city: 42, postalCode: null })
      )
    ).toEqual({ ...stored, city: '', postalCode: '' });
  });
});

describe('formatMetadataShippingAddress', () => {
  test('newline separator + country reproduces the webhook email rendering', () => {
    expect(
      formatMetadataShippingAddress(metadataWith(stored), '\n', 'CA')
    ).toBe('Ada Lovelace\n1 Analytical Way\nApt 4\nToronto, ON\nM5V 2T6\nCA');
  });

  test('comma separator without country reproduces the admin "Ship to:" rendering', () => {
    expect(formatMetadataShippingAddress(metadataWith(stored), ', ')).toBe(
      'Ada Lovelace, 1 Analytical Way, Apt 4, Toronto, ON, M5V 2T6'
    );
  });

  test('empty fields drop out of both renderings', () => {
    const noLine2 = { ...stored, line2: '' };
    expect(formatMetadataShippingAddress(metadataWith(noLine2), '\n', 'CA')).toBe(
      'Ada Lovelace\n1 Analytical Way\nToronto, ON\nM5V 2T6\nCA'
    );
    expect(formatMetadataShippingAddress(metadataWith(noLine2), ', ')).toBe(
      'Ada Lovelace, 1 Analytical Way, Toronto, ON, M5V 2T6'
    );
  });

  test('city/province share one comma-separated line in the newline rendering', () => {
    const noProvince = { ...stored, province: '' };
    expect(
      formatMetadataShippingAddress(metadataWith(noProvince), '\n', 'CA')
    ).toBe('Ada Lovelace\n1 Analytical Way\nApt 4\nToronto\nM5V 2T6\nCA');
  });

  test('returns null for absent or unparseable metadata', () => {
    expect(formatMetadataShippingAddress(undefined, '\n')).toBeNull();
    expect(
      formatMetadataShippingAddress({ shipping_address: '{oops' }, ', ')
    ).toBeNull();
  });
});
