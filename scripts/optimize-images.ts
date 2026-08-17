// scripts/optimize-images.ts
//
// Build-time image variant generator. Scans public/products/<slug>/ for source
// images and produces WebP variants at each width in VARIANT_WIDTHS into
// public/products/<slug>/variants/. Idempotent: existing variants whose mtime
// is at least as new as their source are skipped, unless the pipeline version
// changed (see PIPELINE_VERSION).
//
// Run directly: `bun scripts/optimize-images.ts`
// Also wired into every build path via package.json scripts.

import {
  readdirSync,
  existsSync,
  statSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { VARIANT_WIDTHS, variantFileFor } from '../src/lib/image-variants';

const PRODUCTS_DIR = join(process.cwd(), 'public', 'products');

// Bump when the pipeline below changes in a way that makes previously
// generated variants stale (e.g. adding EXIF auto-orientation). A marker file
// records the version so the mtime idempotency check is bypassed once after a
// pipeline change.
const PIPELINE_VERSION = 2;
const VERSION_MARKER = join(PRODUCTS_DIR, '.variants-version');

// Matches image files (case-insensitive). Non-recursive scan: the `variants/`
// subdirectory is never descended into.
const IMAGE_FILE_PATTERN = /\.(jpe?g|png|webp|avif)$/i;

interface Summary {
  generated: number;
  skipped: number;
  bytes: number;
}

async function generateVariants(): Promise<void> {
  if (!existsSync(PRODUCTS_DIR)) {
    console.log(`optimize-images: ${PRODUCTS_DIR} not found; nothing to do.`);
    return;
  }

  const summary: Summary = { generated: 0, skipped: 0, bytes: 0 };
  let hadError = false;

  // Bypass the mtime skip once after a pipeline change so stale variants
  // (e.g. generated before EXIF auto-orientation) are regenerated.
  const forceRebuild =
    !existsSync(VERSION_MARKER) ||
    readFileSync(VERSION_MARKER, 'utf8').trim() !== String(PIPELINE_VERSION);

  const productDirs = readdirSync(PRODUCTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(PRODUCTS_DIR, entry.name));

  for (const productDir of productDirs) {
    const sourceFiles = readdirSync(productDir).filter((name) =>
      IMAGE_FILE_PATTERN.test(name),
    );

    for (const sourceName of sourceFiles) {
      const sourceFile = join(productDir, sourceName);
      const sourceMtime = statSync(sourceFile).mtimeMs;

      for (const width of VARIANT_WIDTHS) {
        const target = variantFileFor(sourceFile, width);

        // Idempotency: skip when a variant already exists and is at least as
        // new as its source (unless the pipeline version changed).
        if (
          !forceRebuild &&
          existsSync(target) &&
          statSync(target).mtimeMs >= sourceMtime
        ) {
          summary.skipped += 1;
          continue;
        }

        try {
          mkdirSync(dirname(target), { recursive: true });
          const info = await sharp(sourceFile)
            .rotate() // auto-orient by EXIF tag (portrait photos stored as landscape)
            .resize({ width, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(target);
          summary.generated += 1;
          summary.bytes += info.size;
        } catch (error) {
          hadError = true;
          console.error(
            `optimize-images: failed to generate ${target} from ${sourceFile}:`,
            error,
          );
        }
      }
    }
  }

  console.log(
    `optimize-images: ${summary.generated} generated, ${summary.skipped} skipped, ` +
      `${summary.bytes} bytes of generated variants.`,
  );

  // Record the pipeline version so the next run can skip up-to-date variants.
  writeFileSync(VERSION_MARKER, `${PIPELINE_VERSION}\n`);

  if (hadError) {
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  await generateVariants();
}

export { generateVariants };