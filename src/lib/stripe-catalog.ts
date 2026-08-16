// stripe-catalog.ts
//
// Server-only module: fetches the Stripe product catalog at build time and maps
// it to the app's `Product` shape. Import only from Server Components, route
// handlers, or other server-only modules — never from a client component (it
// imports the `stripe` SDK and reads `process.env.STRIPE_SECRET_KEY`).
//
// The catalog is fetched once per build (memoized with React `cache`) and
// statically prerendered, so there is no per-request Stripe call on the Worker.
// Product images are scanned from `public/products/<slug>/` at build time by
// `imagesForProduct`, falling back to a per-category SVG placeholder when the
// folder is missing.

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import Stripe from 'stripe';
import { cache } from 'react';
import type { Product } from '@/types';

/**
 * Universal placeholder used whenever a Stripe product has no description.
 * One shared string — we do not generate per-product copy.
 */
export const PLACEHOLDER_DESCRIPTION =
  'A handcrafted ribbon flower, made to order from premium satin ribbon. ' +
  'Each bloom is shaped petal by petal, so no two are ever quite alike.';

const PLACEHOLDER_IMAGES: Record<Product['category'], string> = {
  flower: '/placeholders/flower.svg',
  bouquet: '/placeholders/bouquet.svg',
};

/** Derive a URL slug from a product name, e.g. "Cream White Rose" → "cream-white-rose". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toCategory(raw: unknown): Product['category'] {
  return raw === 'bouquet' ? 'bouquet' : 'flower';
}

/**
 * Map a Stripe product + its default price onto the app's `Product` shape.
 * Pure and exported for unit testing.
 */
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

/**
 * Resolve the real product images for a slug from `public/products/<slug>/`.
 * Returns URL paths (e.g. `/products/cream-white/01-main.jpg`), not fs paths.
 * Falls back to the category placeholder SVG when the folder is missing.
 * `baseDir` is injectable for tests; it defaults to the app's `public/products`.
 */
export function imagesForProduct(
  slug: string,
  category: Product['category'],
  baseDir: string = path.join(process.cwd(), 'public', 'products')
): string[] {
  const dir = path.join(baseDir, slug);
  if (!existsSync(dir)) return [PLACEHOLDER_IMAGES[category]];
  return readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
    .sort()
    .map((f) => `/products/${slug}/${f}`);
}

async function fetchCatalog(): Promise<Product[]> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
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

  const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });
  const { data } = await stripe.products.list({
    limit: 100,
    expand: ['data.default_price'],
  });

  const products: Product[] = [];
  for (const p of data) {
    const dp = p.default_price;
    if (typeof dp !== 'object' || dp === null || dp.unit_amount == null) {
      console.warn(
        `[stripe-catalog] Skipping "${p.name}" (${p.id}): no default price.`
      );
      continue;
    }
    const mapped = mapStripeProduct(p, dp);
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

// Memoize across generateStaticParams + every page render during a build so
// the catalog is fetched once, not once per product page.
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