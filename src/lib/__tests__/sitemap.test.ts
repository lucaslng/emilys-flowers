// bun's mock.module registry is process-global across test files, so only getAllProducts/SITE_URL are
// overridden (nothing else consumes them); the flowers flag is driven through its real env-backed path.

import { test, expect, describe, beforeEach, afterEach, mock } from 'bun:test';
import { unsetEnv } from './env-helpers';
import type { Product } from '@/types';

const realStripeCatalog = await import('@/lib/stripe-catalog');
const realSite = await import('@/lib/site');

const sitemapMocks = {
  products: [] as Product[],
};

mock.module('@/lib/stripe-catalog', () => ({
  ...realStripeCatalog,
  getAllProducts: async () => sitemapMocks.products,
}));

const sitemap = (await import('@/app/sitemap')).default;

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod_rose',
    slug: 'pink-rose',
    name: 'Pink Rose',
    description: 'A rose.',
    price: 399,
    images: ['/placeholders/flower.svg'],
    category: 'flower',
    tags: [],
    inStock: true,
    ...overrides,
  };
}

describe('sitemap', () => {
  beforeEach(() => {
    unsetEnv('FLOWERS_ENABLED');
    sitemapMocks.products = [];
  });

  afterEach(() => {
    unsetEnv('FLOWERS_ENABLED');
  });

  test('product entries carry lastModified derived from updatedAt', async () => {
    sitemapMocks.products = [
      makeProduct({ slug: 'pink-rose', updatedAt: 1756000000 }),
    ];
    const routes = await sitemap();
    const productRoute = routes.find(
      (r) => r.url === `${realSite.SITE_URL}/products/pink-rose`
    );
    expect(productRoute?.lastModified).toEqual(new Date(1756000000 * 1000));
  });

  test('a product without updatedAt yields no lastModified', async () => {
    sitemapMocks.products = [makeProduct({ slug: 'no-stamp' })];
    const routes = await sitemap();
    const productRoute = routes.find(
      (r) => r.url === `${realSite.SITE_URL}/products/no-stamp`
    );
    expect(productRoute?.lastModified).toBeUndefined();
  });

  test('static route entries have no lastModified', async () => {
    sitemapMocks.products = [
      makeProduct({ category: 'bouquet', slug: 'bouquet-one' }),
    ];
    const routes = await sitemap();
    for (const path of ['', '/flowers', '/bouquets', '/faq', '/terms', '/privacy']) {
      const entry = routes.find((r) => r.url === `${realSite.SITE_URL}${path}`);
      expect(entry).toBeDefined();
      expect(entry?.lastModified).toBeUndefined();
    }
  });

  test('/terms and /privacy are listed with low yearly priority', async () => {
    const routes = await sitemap();
    for (const path of ['/terms', '/privacy']) {
      const entry = routes.find((r) => r.url === `${realSite.SITE_URL}${path}`);
      expect(entry).toBeDefined();
      expect(entry?.changeFrequency).toBe('yearly');
      expect(entry?.priority).toBe(0.3);
    }
  });

  test('cart, checkout, and admin routes are absent', async () => {
    const urls = (await sitemap()).map((r) => r.url);
    for (const path of ['/cart', '/checkout', '/admin/orders']) {
      expect(urls).not.toContain(`${realSite.SITE_URL}${path}`);
    }
  });

  test('/flowers appears only when flowers are enabled', async () => {
    let urls = (await sitemap()).map((r) => r.url);
    expect(urls).toContain(`${realSite.SITE_URL}/flowers`);

    process.env.FLOWERS_ENABLED = 'false';
    urls = (await sitemap()).map((r) => r.url);
    expect(urls).not.toContain(`${realSite.SITE_URL}/flowers`);
  });

  test('flower-category products are filtered out when flowers are disabled', async () => {
    process.env.FLOWERS_ENABLED = 'false';
    sitemapMocks.products = [
      makeProduct({ slug: 'pink-rose', category: 'flower' }),
      makeProduct({ slug: 'bouquet-one', category: 'bouquet' }),
    ];
    const urls = (await sitemap()).map((r) => r.url);
    expect(urls).not.toContain(`${realSite.SITE_URL}/products/pink-rose`);
    expect(urls).toContain(`${realSite.SITE_URL}/products/bouquet-one`);
  });
});
