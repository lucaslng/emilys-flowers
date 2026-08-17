// src/lib/image-variants.ts
//
// Single source of truth for the build-time image variant naming contract.
// Product photos live at public/products/<slug>/<file>.(jpg|jpeg|png|webp|avif);
// the parallel optimize-images lane generates WebP variants into
// public/products/<slug>/variants/<file>-<width>.webp, and the custom
// next/image loader (src/lib/image-loader.ts) resolves requests to them.

export const VARIANT_WIDTHS: number[] = [320, 480, 640, 960, 1280, 1600];

/**
 * Returns the closest value in VARIANT_WIDTHS to `width`. On ties the larger
 * width wins (e.g. 400 -> 480, 800 -> 960).
 */
export function nearestVariantWidth(width: number): number {
  let nearest = VARIANT_WIDTHS[0];
  for (const candidate of VARIANT_WIDTHS) {
    // `<=` so equidistant candidates resolve to the larger width.
    if (Math.abs(candidate - width) <= Math.abs(nearest - width)) {
      nearest = candidate;
    }
  }
  return nearest;
}

// Matches /products/<slug>/<file>.<ext> (case-insensitive extension).
const PRODUCT_IMAGE_PATTERN =
  /^\/products\/([^/]+)\/([^/]+)\.(jpg|jpeg|png|webp|avif)$/i;

/**
 * Maps a product image URL to its variant URL, e.g.
 * `/products/creamy-white/01-main.jpg` -> `/products/creamy-white/variants/01-main-480.webp`.
 * Non-product URLs are returned unchanged.
 */
export function variantPathFor(src: string, width: number): string {
  const match = PRODUCT_IMAGE_PATTERN.exec(src);
  if (!match) return src;
  const [, slug, basename] = match;
  return `/products/${slug}/variants/${basename}-${nearestVariantWidth(width)}.webp`;
}

// Matches a filesystem path ending in products/<slug>/<file>.<ext>, allowing
// any leading directory prefix (e.g. `public/`).
const PRODUCT_FILE_PATTERN =
  /^(.*\/)?products\/([^/]+)\/([^/]+)\.(jpg|jpeg|png|webp|avif)$/i;

/**
 * Same mapping as variantPathFor but for filesystem paths, e.g.
 * `public/products/creamy-white/01-main.jpg` -> `public/products/creamy-white/variants/01-main-480.webp`.
 * Paths that don't match the product-file pattern are returned unchanged.
 */
export function variantFileFor(sourceFile: string, width: number): string {
  const match = PRODUCT_FILE_PATTERN.exec(sourceFile);
  if (!match) return sourceFile;
  const [, prefix, slug, basename] = match;
  return `${prefix ?? ""}products/${slug}/variants/${basename}-${nearestVariantWidth(width)}.webp`;
}