'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { formatCAD } from '@/lib/format';
import { Product } from '@/types';
import Button from '@/components/ui/Button';
import ProductImage from '@/components/shop/ProductImage';
import OutOfStockStamp from '@/components/shop/OutOfStockStamp';
import { addWithPetalBurst } from '@/lib/petal-burst';

interface ProductCardProps {
  product: Product;
  /** Rose hairline border + soft shadow + "Featured" ink-stamp tag. */
  emphasized?: boolean;
  /** Layout classes (order / col-span / lift) applied by the featured grid. */
  className?: string;
  /** Above-the-fold image: loads eagerly with fetchpriority=high (no preload). */
  priority?: boolean;
  /** Listing pages pass "h2" so the heading outline reads h1 → h2 → h3. */
  headingLevel?: 'h2' | 'h3';
}

export default function ProductCard({
  product,
  emphasized = false,
  className = '',
  priority = false,
  headingLevel = 'h3',
}: ProductCardProps) {
  const { addToCart } = useCart();
  const Heading = headingLevel as 'h2' | 'h3';

  return (
    <div
      className={`gift-card group flex h-full flex-col ${
        emphasized ? 'is-emphasized' : ''
      } ${className}`.trim()}
    >
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-square overflow-hidden bg-blush/30"
        aria-label={product.name}
      >
        <div aria-hidden="true" className="wrapping-grid absolute inset-0 opacity-70" />
        <ProductImage
          product={product}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
          priority={priority}
        />
        {emphasized && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-3 select-none border border-rose-line/70 bg-background/85 px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.2em] text-rose-deep"
          >
            Featured
          </span>
        )}
        {!product.inStock && <OutOfStockStamp />}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="gift-divider -mx-5 mb-4" />
        <Heading className="gift-name font-sans text-base font-bold uppercase tracking-[0.08em] text-foreground">
          <Link href={`/products/${product.slug}`}>{product.name}</Link>
        </Heading>
        <p className="mt-1.5 line-clamp-2 font-sans text-sm leading-relaxed text-muted">
          {product.description}
        </p>

        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="font-sans text-lg font-bold tabular-nums text-foreground">
            {formatCAD(product.price)}
          </span>
          <Button
            variant="primary"
            size="sm"
            disabled={!product.inStock}
            onClick={(e) => {
              addToCart(product);
              addWithPetalBurst(e.currentTarget);
            }}
          >
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  );
}