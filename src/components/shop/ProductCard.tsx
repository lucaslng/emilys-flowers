'use client';

import { useCart } from '@/lib/cart-context';
import { formatPrice } from '@/lib/format';
import { Product } from '@/types';
import Button from '@/components/ui/Button';
import ProductImage from '@/components/shop/ProductImage';
import { firePetalBurst } from '@/lib/petal-burst';

interface ProductCardProps {
  product: Product;
  /** Featured-only emphasis: rose hairline border + a soft single shadow +
   *  a small "Featured" ink-stamp tag. Listing grids pass nothing (false). */
  emphasized?: boolean;
  /** Optional layout classes (order / col-span / lift) applied to the card
   *  root by the featured grid. Listing grids pass nothing. */
  className?: string;
}

export default function ProductCard({
  product,
  emphasized = false,
  className = '',
}: ProductCardProps) {
  const { addToCart } = useCart();

  return (
    <div
      className={`plaque-card group flex h-full flex-col ${
        emphasized ? 'is-emphasized' : ''
      } ${className}`.trim()}
    >
      {/* Image — edge-to-edge, sharp corners */}
      <div className="relative aspect-square overflow-hidden bg-[#F9E4E4]/40">
        <ProductImage
          product={product}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
        />
        {emphasized && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-3 select-none border border-[#D4A5A5]/70 bg-[#FFFAFA]/85 px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.2em] text-[#D4A5A5]"
          >
            Featured
          </span>
        )}
        {!product.inStock && (
          <div className="absolute inset-0 z-[2] flex items-center justify-center bg-[#FFFAFA]/80">
            <span className="rounded-lg bg-[#4A3B3B] px-4 py-2 font-sans text-sm font-semibold text-white">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Specimen label */}
      <div className="flex flex-1 flex-col p-5">
        <div className="plaque-divider -mx-5 mb-4" />
        <h3 className="plaque-name font-serif text-lg font-semibold text-[#4A3B3B]">
          {product.name}
        </h3>
        <p className="mt-1 line-clamp-2 font-sans text-sm text-[#8B7B7B]">
          {product.description}
        </p>

        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="font-serif text-xl font-bold tabular-nums text-[#4A3B3B]">
            ${formatPrice(product.price)}
          </span>
          <Button
            variant="primary"
            size="sm"
            disabled={!product.inStock}
            onClick={(e) => {
              addToCart(product);
              const btn = e.currentTarget.getBoundingClientRect();
              const cart = document.getElementById('cart-icon')?.getBoundingClientRect();
              if (cart) {
                firePetalBurst(
                  { x: btn.left + btn.width / 2, y: btn.top + btn.height / 2 },
                  { x: cart.left + cart.width / 2, y: cart.top + cart.height / 2 }
                );
              }
            }}
          >
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  );
}