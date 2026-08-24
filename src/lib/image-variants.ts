// Build-time image variant naming contract: photos at public/products/<slug>/<file>.<ext>,
// WebP variants at public/products/<slug>/variants/<file>-<width>.webp, resolved by the custom next/image loader.

export const VARIANT_WIDTHS: number[] = [320, 480, 640, 960, 1280, 1600];

// Canonical extension rule shared by the manifest scanner and the Stripe catalog.
export const IMAGE_EXT_SOURCE = 'jpe?g|png|webp|avif';
export const IMAGE_EXT = new RegExp(`\\.(?:${IMAGE_EXT_SOURCE})$`, 'i');

/** Closest VARIANT_WIDTHS entry; ties resolve to the larger width. */
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
const PRODUCT_IMAGE_PATTERN = new RegExp(
  `^\\/products\\/([^/]+)\\/([^/]+)\\.(?:${IMAGE_EXT_SOURCE})$`,
  'i'
);

/** URL twin of variantFileFor: /products/<slug>/<file>.jpg -> /products/<slug>/variants/<file>-<w>.webp; non-product URLs unchanged. */
export function variantPathFor(src: string, width: number): string {
  const match = PRODUCT_IMAGE_PATTERN.exec(src);
  if (!match) return src;
  const [, slug, basename] = match;
  return `/products/${slug}/variants/${basename}-${nearestVariantWidth(width)}.webp`;
}

// Matches a filesystem path ending in products/<slug>/<file>.<ext>, allowing any leading directory prefix.
const PRODUCT_FILE_PATTERN = new RegExp(
  `^(.*\\/)?products\\/([^/]+)\\/([^/]+)\\.(?:${IMAGE_EXT_SOURCE})$`,
  'i'
);

/** Filesystem twin of variantPathFor; unmatched paths unchanged. */
export function variantFileFor(sourceFile: string, width: number): string {
  const match = PRODUCT_FILE_PATTERN.exec(sourceFile);
  if (!match) return sourceFile;
  const [, prefix, slug, basename] = match;
  return `${prefix ?? ""}products/${slug}/variants/${basename}-${nearestVariantWidth(width)}.webp`;
}