// PRODUCT_IMAGES parsing is memoized per raw value, so each test sets its own value and restores it afterwards.

import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { unsetEnv } from './env-helpers';
import { resolveReceiptImage } from '@/lib/receipt-images';

const ORIGINAL = process.env.PRODUCT_IMAGES;

describe('resolveReceiptImage', () => {
  afterEach(() => {
    if (ORIGINAL === undefined) unsetEnv("PRODUCT_IMAGES");
    else process.env.PRODUCT_IMAGES = ORIGINAL;
  });

  test('resolves a known product name to its manifest image', () => {
    process.env.PRODUCT_IMAGES = JSON.stringify({
      'green-evangeline': '/products/green-evangeline/01-main.jpg',
    });

    expect(resolveReceiptImage('Green Evangeline')).toBe(
      '/products/green-evangeline/01-main.jpg'
    );
  });

  test('falls back to the flower placeholder on a manifest miss', () => {
    process.env.PRODUCT_IMAGES = JSON.stringify({
      'green-evangeline': '/products/green-evangeline/01-main.jpg',
    });

    expect(resolveReceiptImage('Aurora Bloom')).toBe(
      '/placeholders/flower.svg'
    );
  });

  test('falls back to the category placeholder when given', () => {
    process.env.PRODUCT_IMAGES = '{}';

    expect(resolveReceiptImage('Blush Romance', 'bouquet')).toBe(
      '/placeholders/bouquet.svg'
    );
    // Only 'bouquet' is honored — anything else falls back to flower.
    expect(resolveReceiptImage('Blush Romance', 'wreath')).toBe(
      '/placeholders/flower.svg'
    );
  });

  test('tolerates missing and invalid PRODUCT_IMAGES JSON', () => {
    unsetEnv("PRODUCT_IMAGES");
    expect(resolveReceiptImage('Green Evangeline')).toBe(
      '/placeholders/flower.svg'
    );

    process.env.PRODUCT_IMAGES = '{not json';
    expect(resolveReceiptImage('Green Evangeline')).toBe(
      '/placeholders/flower.svg'
    );

    process.env.PRODUCT_IMAGES = JSON.stringify(['not', 'an', 'object']);
    expect(resolveReceiptImage('Green Evangeline')).toBe(
      '/placeholders/flower.svg'
    );
  });

  test('ignores manifest entries that are not /products/ paths', () => {
    process.env.PRODUCT_IMAGES = JSON.stringify({
      'evil-slug': 'https://evil.example/pixel.png',
      'also-evil': '../../secrets',
    });

    expect(resolveReceiptImage('Evil Slug')).toBe('/placeholders/flower.svg');
  });
});
