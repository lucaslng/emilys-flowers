// payload-catalog.ts
//
// Server-only module: reads the product catalog from Payload CMS (D1, via the
// Payload config) and maps it to the app's `Product` shape. Import only from
// Server Components, route handlers, or other server-only modules — never from
// a client component (it imports the Payload config and touches the D1 binding).
//
// Reads are per-request (no memoization of query results), so on-demand
// revalidation (`revalidateTag('products', 'max')` from the webhook route or
// Payload hooks) always sees fresh data. Only the Payload instance itself is
// memoized per request with React `cache`. At build time D1 is empty, so
// pages relying on `generateStaticParams` produce no static slugs and render
// on first request (runtime-only first-request generation — see the migration
// plan, "ISR wiring / Pages").
//
// `getPayload` and the Payload config are imported lazily (dynamic `import()`)
// inside the query path, never statically: a static `@payload-config` import
// drags the whole Payload + Lexical module graph into any importer of this
// file (including `bun test`, which crashes on the Lexical circular-init).

import { cache } from 'react';
import type { Product } from '@/types';

/**
 * Universal placeholder used whenever a product has no description.
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
 * Structural shape of a Payload `products` doc — mirrors
 * `src/collections/Products.ts`. Typed here rather than from the generated
 * `payload-types.ts` (not generated/committed yet on this branch) so the
 * mapper stays pure and unit-testable.
 */
export interface PayloadProductDoc {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  category: string;
  tags?: { tag?: string | null }[] | null;
  featured?: boolean | null;
  featuredOrder?: number | null;
  inStock?: boolean | null;
  flowerType?: string | null;
  color?: string | null;
  media?: { url?: string | null }[] | null;
}

/**
 * Map a Payload products doc onto the app's `Product` shape.
 * Pure and exported for unit testing.
 */
export function mapPayloadProduct(doc: PayloadProductDoc): Product {
  const category = toCategory(doc.category);
  const featured = doc.featured === true || doc.featuredOrder != null;

  const tags: string[] = [];
  if (doc.flowerType) tags.push(doc.flowerType);
  if (doc.color) tags.push(doc.color);
  if (featured) tags.push('featured');

  // Media is optional — fall back to the category SVG placeholder when the
  // doc has no uploads (or its uploads carry no usable URL).
  const mediaImages = (doc.media ?? [])
    .map((m) => m.url)
    .filter((url): url is string => Boolean(url));

  return {
    id: doc.id,
    slug: doc.slug,
    name: doc.name,
    description: doc.description?.trim() || PLACEHOLDER_DESCRIPTION,
    price: doc.price,
    images: mediaImages.length > 0 ? mediaImages : [PLACEHOLDER_IMAGES[category]],
    category,
    tags,
    featured,
    featuredOrder: doc.featuredOrder ?? undefined,
    inStock: doc.inStock !== false,
    flowerType: doc.flowerType ?? undefined,
    color: doc.color ?? undefined,
  };
}

// One Payload instance per request (React `cache` is request-scoped in
// Next 15+). Queries below are never memoized — each call is a fresh D1 read.
const getPayloadInstance = cache(async () => {
  const [{ getPayload }, { default: payloadConfig }] = await Promise.all([
    import('payload'),
    import('@payload-config'),
  ]);
  return getPayload({ config: payloadConfig });
});

async function fetchProducts(): Promise<Product[]> {
  try {
    const payload = await getPayloadInstance();
    const { docs } = await payload.find({
      collection: 'products',
      limit: 100,
    });

    const products: Product[] = [];
    for (const doc of docs) {
      if (typeof doc.price !== 'number') {
        console.warn(
          `[payload-catalog] Skipping "${doc.name}" (${doc.id}): no price.`
        );
        continue;
      }
      products.push(mapPayloadProduct(doc as unknown as PayloadProductDoc));
    }

    return dedupeSlugs(products);
  } catch (error) {
    // Build-time tolerance: during `next build` D1 is unmigrated/unseeded, so
    // catalog reads must degrade to an empty catalog — `generateStaticParams`
    // then emits no slugs and pages render on first request (runtime-only
    // first-request generation). At runtime a failed read is a real error.
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      console.warn(
        '[payload-catalog] Build-time Payload read failed; treating catalog as empty.',
        error
      );
      return [];
    }
    throw error;
  }
}

/** Ensure slugs are unique (append -2, -3… on collision — defensive; Payload enforces slug uniqueness). */
function dedupeSlugs(products: Product[]): Product[] {
  const seen = new Map<string, number>();
  return products.map((p) => {
    const count = seen.get(p.slug) ?? 0;
    seen.set(p.slug, count + 1);
    return count === 0 ? p : { ...p, slug: `${p.slug}-${count + 1}` };
  });
}

/** All products in the catalog. */
export function getAllProducts(): Promise<Product[]> {
  return fetchProducts();
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

/** Featured products, ordered by their featured rank (1, 2, 3…). */
export async function getFeaturedProducts(): Promise<Product[]> {
  const products = await getAllProducts();
  return products
    .filter((p) => p.featured)
    .sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0));
}
