// Server-only (imports the stripe SDK, reads STRIPE_SECRET_KEY): catalog fetched once per build via React cache,
// images scanned from public/products/<slug>/ with a per-category SVG placeholder fallback.

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type Stripe from 'stripe';
import { cache } from 'react';
import type { Product } from '@/types';
import { slugify } from '@/lib/slugify';
import { IMAGE_EXT } from '@/lib/image-variants';
import { listActiveProducts } from '@/lib/stripe-products';
import { getStripeClient } from '@/lib/stripe-client';

export { slugify };

/** Shared placeholder for products without a description — deliberately not per-product copy. */
export const PLACEHOLDER_DESCRIPTION =
  'A handcrafted ribbon flower, made to order from premium satin ribbon. ' +
  'Each bloom is shaped petal by petal, so no two are ever quite alike.';

const PLACEHOLDER_IMAGES: Record<Product['category'], string> = {
  flower: '/placeholders/flower.svg',
  bouquet: '/placeholders/bouquet.svg',
};

function toCategory(raw: unknown): Product['category'] {
  return raw === 'bouquet' ? 'bouquet' : 'flower';
}

export function mapStripeProduct(
  product: Stripe.Product,
  price: Stripe.Price
): Product {
  const category = toCategory(product.metadata?.category);
  const flowerType = product.metadata?.flower_type;
  const color = product.metadata?.color;
  const featuredRaw = product.metadata?.featured;
  const featuredOrder = featuredRaw ? Number(featuredRaw) : undefined;

  const tags: string[] = [];
  if (flowerType) tags.push(flowerType);
  if (color) tags.push(color);
  if (featuredOrder !== undefined) tags.push('featured');

  return {
    id: product.id,
    slug: slugify(product.name),
    name: product.name,
    description: product.description?.trim() || PLACEHOLDER_DESCRIPTION,
    price: price.unit_amount ?? 0,
    images: [PLACEHOLDER_IMAGES[category]],
    category,
    tags,
    featured: featuredOrder !== undefined,
    featuredOrder,
    inStock: product.active,
    flowerType,
    color,
  };
}

/** Real images from public/products/<slug>/ as URL paths; placeholder fallback keeps `images` never empty. baseDir injectable for tests. */
export function imagesForProduct(
  slug: string,
  category: Product['category'],
  baseDir: string = path.join(process.cwd(), 'public', 'products')
): string[] {
  const dir = path.join(baseDir, slug);
  if (!existsSync(dir)) return [PLACEHOLDER_IMAGES[category]];
  const files = readdirSync(dir)
    .filter((f) => IMAGE_EXT.test(f))
    .sort();
  return files.length > 0
    ? files.map((f) => `/products/${slug}/${f}`)
    : [PLACEHOLDER_IMAGES[category]];
}

async function fetchCatalog(): Promise<Product[]> {
  const stripe = getStripeClient();
  if (!stripe) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[stripe-catalog] No STRIPE_SECRET_KEY; returning an empty catalog for dev.'
      );
      return [];
    }
    throw new Error(
      'STRIPE_SECRET_KEY is required to build the product catalog. ' +
        'Set it in the build environment (deploy.yml) or a local env file.'
    );
  }

  const listed = await listActiveProducts(stripe, 'stripe-catalog');

  const products: Product[] = [];
  for (const p of listed) {
    const mapped = mapStripeProduct(p, p.default_price);
    products.push({
      ...mapped,
      images: imagesForProduct(mapped.slug, mapped.category),
    });
  }

  return dedupeSlugs(products);
}

/** Ensure slugs are unique (append -2, -3… on collision). */
function dedupeSlugs(products: Product[]): Product[] {
  const seen = new Map<string, number>();
  return products.map((p) => {
    const count = seen.get(p.slug) ?? 0;
    seen.set(p.slug, count + 1);
    return count === 0 ? p : { ...p, slug: `${p.slug}-${count + 1}` };
  });
}

// React cache() at module scope so one fetch serves generateStaticParams + every page render.
const getAllProductsCached = cache(fetchCatalog);

/** All active, priceable products in the catalog. */
export function getAllProducts(): Promise<Product[]> {
  return getAllProductsCached();
}

/** Look up a single product by its URL slug. */
export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const products = await getAllProducts();
  return products.find((p) => p.slug === slug);
}

/** All products in a category. */
export async function getProductsByCategory(
  category: Product['category']
): Promise<Product[]> {
  const products = await getAllProducts();
  return products.filter((p) => p.category === category);
}

/** Featured products, ordered by their Stripe featured rank (1, 2, 3…). */
export async function getFeaturedProducts(): Promise<Product[]> {
  const products = await getAllProducts();
  return products
    .filter((p) => p.featured)
    .sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0));
}