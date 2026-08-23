// product-image-manifest.ts
//
// Node-only, build-time module: scans `public/products/<slug>/` folders and
// produces a slug → primary-image-URL manifest. next.config.ts evaluates it
// once per build and inlines the JSON via the `env` config (same pattern as
// UNDER_CONSTRUCTION / FLOWERS_ENABLED), so Workers-safe runtime code
// (receipt-images) can resolve receipt images without touching node:fs.
//
// Do NOT import this from client components or route handlers — it reads the
// filesystem. Runtime consumers go through `src/lib/receipt-images.ts`.

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { slugify } from '@/lib/slugify';

/** Same image-extension rule as `imagesForProduct` in stripe-catalog.ts. */
const IMAGE_EXTENSION = /\.(jpe?g|png|webp|avif)$/i;

/**
 * Scan `baseDir` (default: `<cwd>/public/products`) for per-product image
 * folders and map each folder name to its first sorted image file as a
 * same-origin URL path, e.g.
 * `{ "green-evangeline": "/products/green-evangeline/01-main.jpg" }`.
 *
 * Folder names are used as-is (they are already slugs on disk); names are not
 * re-derived, so the manifest keys match what `slugify(product.name)` yields
 * for the catalog's naming. Folders with no image files are omitted — callers
 * fall back to the category placeholder.
 *
 * `baseDir` is injectable for tests.
 */
export function scanProductImages(
  baseDir: string = path.join(process.cwd(), 'public', 'products')
): Record<string, string> {
  if (!existsSync(baseDir)) return {};

  const manifest: Record<string, string> = {};
  for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const files = readdirSync(path.join(baseDir, entry.name))
      .filter((f) => IMAGE_EXTENSION.test(f))
      .sort();
    const primary = files[0];
    if (primary) {
      manifest[slugify(entry.name)] = `/products/${entry.name}/${primary}`;
    }
  }
  return manifest;
}
