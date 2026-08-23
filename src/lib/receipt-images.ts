// receipt-images.ts
//
// Workers-safe module (no node:fs, no Stripe SDK): resolves the thumbnail for
// a checkout-success receipt line item. The slug → image manifest is scanned
// at build time by product-image-manifest.ts and inlined into the bundle via
// next.config.ts's `env` config as PRODUCT_IMAGES; this module only parses
// that JSON.

import { slugify } from '@/lib/slugify';

/**
 * Memoized parse of PRODUCT_IMAGES. Keyed on the raw env value: in production
 * it never changes after build, so the JSON is parsed exactly once; tests can
 * swap process.env.PRODUCT_IMAGES between calls without a reset hook.
 */
let cachedRaw: string | undefined;
let cachedManifest: Record<string, string> = {};

function getManifest(): Record<string, string> {
  const raw = process.env.PRODUCT_IMAGES;
  if (raw === cachedRaw) return cachedManifest;
  cachedRaw = raw;

  cachedManifest = {};
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        for (const [slug, image] of Object.entries(parsed)) {
          // Only same-origin /products/ paths are accepted — the manifest is
          // build-generated, but stay defensive about what reaches <img src>.
          if (typeof image === 'string' && image.startsWith('/products/')) {
            cachedManifest[slug] = image;
          }
        }
      }
    } catch {
      // Malformed JSON → empty manifest; every lookup falls back to a placeholder.
    }
  }
  return cachedManifest;
}

/** Placeholder SVG for a category — mirrors stripe-catalog's PLACEHOLDER_IMAGES. */
function categoryPlaceholder(category?: string): string {
  return `/placeholders/${category === 'bouquet' ? 'bouquet' : 'flower'}.svg`;
}

/**
 * Resolve the receipt image for a purchased line item: slugify the product
 * name, look it up in the build-time manifest, and fall back to the category
 * placeholder when there's no real photo.
 */
export function resolveReceiptImage(name: string, category?: string): string {
  const hit = getManifest()[slugify(name)];
  return hit ?? categoryPlaceholder(category);
}
