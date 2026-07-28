'use client';

// Renders the product's primary image (product.images[0]) via next/image.
// On load error, falls back to the per-category local SVG placeholder
// (/placeholders/flower.svg or /placeholders/bouquet.svg) so future
// real-image failures degrade gracefully without broken 404 sprites.

import { useState } from 'react';
import Image from 'next/image';
import { Product } from '@/types';

interface ProductImageProps {
  product: Product;
  alt?: string;       // overrides product.name (checkout/success uses item.name)
  sizes: string;
  className?: string; // applied to both the next/Image and the fallback <img>
  /** Marks this as the page's LCP image (preload + eager + fetchpriority=high). */
  priority?: boolean;
}

export default function ProductImage({
  product,
  alt,
  sizes,
  className = '',
  priority = false,
}: ProductImageProps) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <img
        src={`/placeholders/${product.category}.svg`}
        alt={alt ?? product.name}
        className={`absolute inset-0 h-full w-full ${className ?? ''}`}
      />
    )
  }

  return (
    <Image
      src={product.images[0]}
      alt={alt ?? product.name}
      fill
      sizes={sizes}
      className={className}
      priority={priority}
      onError={() => setErrored(true)}
    />
  )
}
