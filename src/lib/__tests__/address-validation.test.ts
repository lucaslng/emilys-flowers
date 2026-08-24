import { test, expect, describe } from 'bun:test';
import {
  ADDRESS_FIELD_MAX_LENGTHS,
  ADDRESS_FIELD_MESSAGES,
  CA_POSTAL_CODE_REGEX,
  CA_PROVINCES,
  STRIPE_METADATA_VALUE_MAX_LENGTH,
  isValidCAPostalCode,
  normalizeCAPostalCode,
  shippingAddressMetadata,
  shippingAddressMetadataValue,
  truncateDeliveryAddress,
  validateDeliveryAddressFields,
} from '@/lib/address-validation';

describe('isValidCAPostalCode', () => {
  test('accepts canonical "A1A 1A1" codes', () => {
    expect(isValidCAPostalCode('M5V 2T6')).toBe(true);
    expect(isValidCAPostalCode('K1A 0B1')).toBe(true);
  });

  test('is case-insensitive', () => {
    expect(isValidCAPostalCode('m5v 2t6')).toBe(true);
    expect(isValidCAPostalCode('m5v2t6')).toBe(true);
  });

  test('accepts hyphen and missing separators', () => {
    expect(isValidCAPostalCode('M5V-2T6')).toBe(true);
    expect(isValidCAPostalCode('M5V2T6')).toBe(true);
  });

  test('rejects empty and short input', () => {
    expect(isValidCAPostalCode('')).toBe(false);
    expect(isValidCAPostalCode('   ')).toBe(false);
    expect(isValidCAPostalCode('M5V')).toBe(false);
  });

  test('rejects letters-only or digits-only garbage', () => {
    expect(isValidCAPostalCode('ABC')).toBe(false);
    expect(isValidCAPostalCode('12345')).toBe(false);
  });

  test('rejects excluded first-position letters (D/F/I/O/Q/U/W/Z)', () => {
    expect(isValidCAPostalCode('D5V 2T6')).toBe(false);
    expect(isValidCAPostalCode('O5V 2T6')).toBe(false);
    expect(isValidCAPostalCode('Z5V 2T6')).toBe(false);
  });

  test('rejects excluded third-position letters (D/F/I/O/Q/U)', () => {
    expect(isValidCAPostalCode('M5F 2T6')).toBe(false);
    expect(isValidCAPostalCode('M5O 2T6')).toBe(false);
    expect(isValidCAPostalCode('M5U 2T6')).toBe(false);
  });

  test('rejects trailing characters', () => {
    expect(isValidCAPostalCode('M5V 2T61')).toBe(false);
    expect(isValidCAPostalCode('M5V 2T6 ')).toBe(true); // trimmed, not trailing junk
    expect(isValidCAPostalCode('M5V 2T6X')).toBe(false);
  });
});

describe('CA_POSTAL_CODE_REGEX', () => {
  test('has no global/sticky flags so .test() is stateless', () => {
    expect(CA_POSTAL_CODE_REGEX.global).toBe(false);
    expect(CA_POSTAL_CODE_REGEX.sticky).toBe(false);
    // Repeated .test() calls on the same regex must agree.
    expect(CA_POSTAL_CODE_REGEX.test('M5V 2T6')).toBe(true);
    expect(CA_POSTAL_CODE_REGEX.test('M5V 2T6')).toBe(true);
  });
});

describe('normalizeCAPostalCode', () => {
  test('canonicalizes to uppercase with a single-space separator', () => {
    expect(normalizeCAPostalCode('m5v 2t6')).toBe('M5V 2T6');
    expect(normalizeCAPostalCode('M5V-2T6')).toBe('M5V 2T6');
    expect(normalizeCAPostalCode('M5V2T6')).toBe('M5V 2T6');
  });

  test('trims surrounding whitespace', () => {
    expect(normalizeCAPostalCode('  M5V 2T6  ')).toBe('M5V 2T6');
  });

  test('collapses mixed/extra separators', () => {
    expect(normalizeCAPostalCode('m5v - 2t6')).toBe('M5V 2T6');
    expect(normalizeCAPostalCode('M5V  2T6')).toBe('M5V 2T6');
  });

  test('is best-effort for invalid input (no throwing)', () => {
    expect(normalizeCAPostalCode('abc')).toBe('ABC');
    expect(normalizeCAPostalCode('')).toBe('');
  });
});

describe('validateDeliveryAddressFields', () => {
  const validAddress = {
    name: 'Ada Lovelace',
    line1: '1 Analytical Way',
    line2: 'Apt 4',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M5V 2T6',
  };

  test('returns [] for a fully valid address', () => {
    expect(validateDeliveryAddressFields(validAddress)).toEqual([]);
  });

  test('returns [] when line2 is absent (optional field)', () => {
    const { line2: _line2, ...withoutLine2 } = validAddress;
    expect(validateDeliveryAddressFields(withoutLine2)).toEqual([]);
  });

  test('never errors on line2, even when blank', () => {
    expect(
      validateDeliveryAddressFields({ ...validAddress, line2: '   ' })
    ).toEqual([]);
  });

  test('non-object/null input yields one error per required field in form order', () => {
    const expected = (
      ['name', 'line1', 'city', 'province', 'postalCode'] as const
    ).map((field) => ({ field, message: ADDRESS_FIELD_MESSAGES[field] }));

    expect(validateDeliveryAddressFields(null)).toEqual(expected);
    expect(validateDeliveryAddressFields(undefined)).toEqual(expected);
    expect(validateDeliveryAddressFields(42)).toEqual(expected);
    expect(validateDeliveryAddressFields('address')).toEqual(expected);
  });

  test.each(['name', 'line1', 'city', 'province', 'postalCode'] as const)(
    'missing %s yields its ADDRESS_FIELD_MESSAGES message',
    (field) => {
      const blank: Record<string, unknown> = { ...validAddress };
      delete blank[field];
      expect(validateDeliveryAddressFields(blank)).toEqual([
        { field, message: ADDRESS_FIELD_MESSAGES[field] },
      ]);

      const whitespace: Record<string, unknown> = { ...validAddress };
      whitespace[field] = '   ';
      expect(validateDeliveryAddressFields(whitespace)).toEqual([
        { field, message: ADDRESS_FIELD_MESSAGES[field] },
      ]);
    }
  );

  test('invalid non-empty province reports the province-code message', () => {
    expect(
      validateDeliveryAddressFields({ ...validAddress, province: 'XX' })
    ).toEqual([
      {
        field: 'province',
        message:
          'Invalid province code "XX". Must be one of: AB, BC, MB, NB, NL, NS, NT, NU, ON, PE, QC, SK, YT.',
      },
    ]);
  });

  test('province matching is case-insensitive', () => {
    expect(validateDeliveryAddressFields({ ...validAddress, province: 'on' })).toEqual([]);
  });

  test('invalid postal code reports the postal message', () => {
    expect(
      validateDeliveryAddressFields({ ...validAddress, postalCode: '12345' })
    ).toEqual([
      { field: 'postalCode', message: ADDRESS_FIELD_MESSAGES.postalCode },
    ]);
  });

  test('collects every invalid field at once, in form order', () => {
    const errors = validateDeliveryAddressFields({
      name: '',
      line1: '1 Analytical Way',
      city: '',
      province: 'XX',
      postalCode: 'ABC',
    });
    expect(errors.map((error) => error.field)).toEqual([
      'name',
      'city',
      'province',
      'postalCode',
    ]);
  });

  test('non-string field values are treated as missing', () => {
    expect(
      validateDeliveryAddressFields({
        ...validAddress,
        name: 42,
        postalCode: null,
      }).map((error) => error.field)
    ).toEqual(['name', 'postalCode']);
  });

  test('CA_PROVINCES contains all 13 provinces and territories', () => {
    expect(CA_PROVINCES).toEqual([
      'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
    ]);
  });
});

describe('ADDRESS_FIELD_MAX_LENGTHS', () => {
  test('exports a cap for every address field', () => {
    expect(Object.keys(ADDRESS_FIELD_MAX_LENGTHS).sort()).toEqual(
      ['city', 'line1', 'line2', 'name', 'postalCode', 'province'].sort()
    );
  });

  test('caps are sane: province/postalCode tight, free-text fields roomy, all positive integers', () => {
    expect(ADDRESS_FIELD_MAX_LENGTHS).toEqual({
      name: 80,
      line1: 120,
      line2: 80,
      city: 60,
      province: 2,
      postalCode: 7,
    });
    for (const cap of Object.values(ADDRESS_FIELD_MAX_LENGTHS)) {
      expect(Number.isInteger(cap)).toBe(true);
      expect(cap).toBeGreaterThan(0);
    }
  });

  test('fully-filled worst case stays under the Stripe metadata value cap with margin', () => {
    const worstCase = Object.fromEntries(
      Object.entries(ADDRESS_FIELD_MAX_LENGTHS).map(([field, cap]) => [
        field,
        'x'.repeat(cap),
      ])
    );
    // The capped worst case must fit under the 500-char cap.
    expect(JSON.stringify(worstCase).length).toBeLessThan(
      STRIPE_METADATA_VALUE_MAX_LENGTH
    );
  });
});

describe('truncateDeliveryAddress', () => {
  const validAddress = {
    name: 'Ada Lovelace',
    line1: '1 Analytical Way',
    line2: 'Apt 4',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M5V 2T6',
  };

  test('leaves an already-valid address byte-identical', () => {
    expect(truncateDeliveryAddress(validAddress)).toEqual(validAddress);
  });

  test('clamps every over-long field to its cap', () => {
    const overLong = {
      name: 'N'.repeat(200),
      line1: 'L'.repeat(300),
      line2: 'A'.repeat(150),
      city: 'C'.repeat(120),
      province: 'ONTOARIO',
      postalCode: 'M5V 2T6X',
    };
    const truncated = truncateDeliveryAddress(overLong);
    expect(truncated.name).toBe('N'.repeat(ADDRESS_FIELD_MAX_LENGTHS.name));
    expect(truncated.line1).toBe('L'.repeat(ADDRESS_FIELD_MAX_LENGTHS.line1));
    expect(truncated.line2).toBe('A'.repeat(ADDRESS_FIELD_MAX_LENGTHS.line2));
    expect(truncated.city).toBe('C'.repeat(ADDRESS_FIELD_MAX_LENGTHS.city));
    expect(truncated.province).toBe('ON');
    expect(truncated.postalCode).toBe('M5V 2T6');
  });

  test('preserves line2 absence (optional field stays absent)', () => {
    const { line2: _line2, ...withoutLine2 } = validAddress;
    const truncated = truncateDeliveryAddress(withoutLine2);
    expect('line2' in truncated ? truncated.line2 : undefined).toBeUndefined();
  });

  test('is deterministic', () => {
    expect(truncateDeliveryAddress(validAddress)).toEqual(
      truncateDeliveryAddress(validAddress)
    );
  });
});

describe('shippingAddressMetadataValue', () => {
  const validAddress = {
    name: 'Ada Lovelace',
    line1: '1 Analytical Way',
    line2: 'Apt 4',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M5V 2T6',
  };

  test('normal case round-trips all six keys as JSON', () => {
    const value = shippingAddressMetadataValue(validAddress);
    expect(value.length).toBeLessThanOrEqual(STRIPE_METADATA_VALUE_MAX_LENGTH);
    expect(JSON.parse(value)).toEqual(validAddress);
  });

  test('always fits the Stripe metadata value cap — pathological escape inflation included', () => {
    // Quotes double in JSON (`"` → `\"`), far past what field caps alone cover.
    const pathological = {
      name: '"'.repeat(200),
      line1: '"'.repeat(200),
      line2: '"'.repeat(200),
      city: '"'.repeat(200),
      province: 'ON',
      postalCode: 'M5V 2T6',
    };
    const value = shippingAddressMetadataValue(pathological);
    expect(value.length).toBeLessThanOrEqual(STRIPE_METADATA_VALUE_MAX_LENGTH);
    expect(() => JSON.parse(value)).not.toThrow();
    expect(typeof JSON.parse(value)).toBe('object');
  });

  test('backslash-heavy input also stays under the cap and parses', () => {
    const backslashes = {
      name: '\\'.repeat(200),
      line1: '\\'.repeat(200),
      city: '\\'.repeat(200),
      province: 'ON',
      postalCode: 'M5V 2T6',
    };
    const value = shippingAddressMetadataValue(backslashes);
    expect(value.length).toBeLessThanOrEqual(STRIPE_METADATA_VALUE_MAX_LENGTH);
    expect(() => JSON.parse(value)).not.toThrow();
  });

  test('over-long fields are clamped before serialization', () => {
    const value = shippingAddressMetadataValue({
      ...validAddress,
      name: 'N'.repeat(500),
    });
    const parsed = JSON.parse(value) as { name: string };
    expect(parsed.name).toBe('N'.repeat(ADDRESS_FIELD_MAX_LENGTHS.name));
  });

  test('is deterministic', () => {
    const pathological = {
      name: '"'.repeat(200),
      line1: '"'.repeat(200),
      line2: '"'.repeat(200),
      city: '"'.repeat(200),
      province: 'ON',
      postalCode: 'M5V 2T6',
    };
    expect(shippingAddressMetadataValue(pathological)).toBe(
      shippingAddressMetadataValue(pathological)
    );
  });
});

describe('shippingAddressMetadata', () => {
  const validAddress = {
    name: 'Ada Lovelace',
    line1: '1 Analytical Way',
    line2: 'Apt 4',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M5V 2T6',
  };

  test('returns json for metadata and value as the exact parsed form', () => {
    const { json, value } = shippingAddressMetadata(validAddress);
    expect(json.length).toBeLessThanOrEqual(STRIPE_METADATA_VALUE_MAX_LENGTH);
    expect(JSON.parse(json)).toEqual(value);
    expect(value).toEqual(validAddress);
  });

  test('value mirrors the fallback (line2 dropped) when escape inflation overflows', () => {
    const pathological = {
      name: '"'.repeat(200),
      line1: '"'.repeat(200),
      line2: '"'.repeat(200),
      city: '"'.repeat(200),
      province: 'ON',
      postalCode: 'M5V 2T6',
    };
    const { json, value } = shippingAddressMetadata(pathological);
    expect(json.length).toBeLessThanOrEqual(STRIPE_METADATA_VALUE_MAX_LENGTH);
    expect(JSON.parse(json)).toEqual(value);
    expect('line2' in value).toBe(false);
  });

  test('value is clamped to the per-field caps, matching json', () => {
    const { json, value } = shippingAddressMetadata({
      ...validAddress,
      name: 'N'.repeat(500),
    });
    expect(value.name).toBe('N'.repeat(ADDRESS_FIELD_MAX_LENGTHS.name));
    expect((JSON.parse(json) as { name: string }).name).toBe(value.name);
  });
});
