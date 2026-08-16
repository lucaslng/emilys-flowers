'use client';

import { useState } from 'react';
import { Product } from '@/types';
import ProductImage from '@/components/shop/ProductImage';

interface ProductGalleryProps {
  product: Product;
  /** next/image sizes hint for the main image (thumbnails are fixed 64px). */
  sizes: string;
  /** Above-the-fold main image: loads eagerly with fetchpriority=high. */
  priority?: boolean;
}

/**
 * ProductGallery — the specimen-sheet image block. Shows every photo of the
 * product: a main image with a row of small "detail stamps" beneath it.
 * Clicking a stamp swaps the main image; the active stamp wears a rose
 * border + underline (gift-tag language). With a single photo the stamps
 * are omitted entirely. The Out-of-Stock stamp sits over the main image.
 */
export default function ProductGallery({
  product,
  sizes,
  priority = false,
}: ProductGalleryProps) {
  const [selected, setSelected] = useState(0);
  const count = product.images.length;

  return (
    <div>
      {/* Main image */}
      <div className="relative aspect-square overflow-hidden bg-blush/30">
        <ProductImage
          key={selected}
          product={product}
          imageIndex={selected}
          sizes={sizes}
          className="object-cover"
          priority={priority}
        />
        {!product.inStock && (
          <div className="absolute inset-0 z-[2] flex items-center justify-center bg-background/80">
            <span className="border border-rose-line bg-foreground px-4 py-2 font-sans text-sm font-semibold uppercase tracking-[0.12em] text-background">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Detail stamps — only when there is more than one photo */}
      {count > 1 && (
        <div
          role="group"
          aria-label={`${product.name} images`}
          className="-rotate-1 mt-4 flex flex-wrap items-start gap-3 pl-2"
        >
          {product.images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setSelected(i)}
              aria-label={`View image ${i + 1} of ${count}`}
              aria-pressed={selected === i}
              className={`relative block border transition-colors duration-300 ${
                selected === i
                  ? 'border-rose-line'
                  : 'border-border hover:border-rose-line/70'
              }`}
            >
              <span className="relative block aspect-square w-16 overflow-hidden bg-blush/30">
                <ProductImage
                  product={product}
                  imageIndex={i}
                  alt=""
                  sizes="64px"
                  className="object-cover"
                />
              </span>
              <span
                aria-hidden="true"
                className={`absolute -bottom-[3px] left-0 h-[2px] w-full bg-rose-line transition-opacity duration-300 ${
                  selected === i ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}