import { describe, expect, test } from 'bun:test';
import {
  STRIPE_METADATA_VALUE_MAX_LENGTH,
  clampMetadataValue,
} from '@/lib/address-validation';

describe('clampMetadataValue', () => {
  test('clamps a string longer than 500 chars to exactly 500', () => {
    const long = 'x'.repeat(600);
    const clamped = clampMetadataValue(long);
    expect(clamped.length).toBe(STRIPE_METADATA_VALUE_MAX_LENGTH);
    expect(clamped).toBe('x'.repeat(500));
  });

  test('passes through a string at or under 500 chars unchanged', () => {
    expect(clampMetadataValue('2-4 business days')).toBe('2-4 business days');
    expect(clampMetadataValue('y'.repeat(500)).length).toBe(500);
  });

  test('trims leading/trailing whitespace before clamping', () => {
    expect(clampMetadataValue('  2-4 business days  ')).toBe(
      '2-4 business days'
    );
    // Whitespace counts toward the cap: trimming happens first, so 505 padded to 510 clamps to exactly 500.
    expect(clampMetadataValue(`  ${'z'.repeat(505)}  `)).toBe('z'.repeat(500));
  });
});
