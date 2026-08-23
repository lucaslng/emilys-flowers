// Workers-safe (no node:fs): parses the build-time PRODUCT_IMAGES manifest
// inlined by next.config.ts and resolves receipt line items to image paths.

import { slugify } from '@/lib/slugify';

// Keyed on the raw env value: parsed once in production, but tests can swap
// process.env.PRODUCT_IMAGES without a reset hook.
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
          // Only same-origin paths may reach <img src>.
          if (typeof image === 'string' && image.startsWith('/products/')) {
            cachedManifest[slug] = image;
          }
        }
      }
    } catch {
      // Invalid JSON → empty manifest; lookups fall back to placeholders.
    }
  }
  return cachedManifest;
}

function categoryPlaceholder(category?: string): string {
  return `/placeholders/${category === 'bouquet' ? 'bouquet' : 'flower'}.svg`;
}

/** Manifest lookup by product name; category placeholder on a miss. */
export function resolveReceiptImage(name: string, category?: string): string {
  const hit = getManifest()[slugify(name)];
  return hit ?? categoryPlaceholder(category);
}
