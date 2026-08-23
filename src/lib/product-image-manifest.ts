// Node-only, build-time: scans public/products/<slug>/ into a slug →
// primary-image manifest, inlined by next.config.ts as PRODUCT_IMAGES.
// Runtime consumers go through receipt-images.ts — never import this there.

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { slugify } from '@/lib/slugify';

// Same image-extension rule as imagesForProduct in stripe-catalog.ts.
const IMAGE_EXTENSION = /\.(jpe?g|png|webp|avif)$/i;

/**
 * Map each product folder to its first sorted image file, e.g.
 * `{ "green-evangeline": "/products/green-evangeline/01-main.jpg" }`.
 * Folders with no image files are omitted; `baseDir` is injectable for tests.
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
