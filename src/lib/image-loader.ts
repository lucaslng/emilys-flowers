// src/lib/image-loader.ts
//
// Custom next/image loader: resolves every image request to a pre-generated
// WebP variant (see src/lib/image-variants.ts). Non-product sources pass
// through unchanged.
import type { ImageLoaderProps } from "next/image";
import { variantPathFor } from "./image-variants";

export default function imageLoader({ src, width }: ImageLoaderProps): string {
  return variantPathFor(src, width);
}