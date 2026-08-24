'use client';

// On load error, falls back to the per-category local SVG placeholder so
// real-image failures degrade gracefully without broken 404 sprites.

import { useState } from 'react';
import Image from 'next/image';
import { Product } from '@/types';

interface ProductImageProps {
  product: Product;
  alt?: string;
  sizes: string;
  className?: string;
  /** Above-the-fold image: loads eagerly with fetchpriority=high (no preload). */
  priority?: boolean;
  /** Index into product.images to render (default 0 — the primary image). */
  imageIndex?: number;
}

export default function ProductImage({
  product,
  alt,
  sizes,
  className = '',
  priority = false,
  imageIndex = 0,
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
      src={product.images[imageIndex]}
      alt={alt ?? product.name}
      fill
      sizes={sizes}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      onError={() => setErrored(true)}
    />
  )
}
