// slugify.ts
//
// Shared pure helper: derive a URL slug from a product name, e.g.
// "Cream White Rose" → "cream-white-rose". Kept dependency-free so both
// Node-only build-time modules (stripe-catalog, product-image-manifest) and
// Workers-safe runtime modules (receipt-images) can import it.

/** Derive a URL slug from a product name, e.g. "Cream White Rose" → "cream-white-rose". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
