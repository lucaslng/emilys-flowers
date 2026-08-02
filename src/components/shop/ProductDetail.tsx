'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { formatPrice } from '@/lib/format';
import { formatLabel } from '@/lib/product-utils';
import { Product } from '@/types';
import Button from '@/components/ui/Button';
import ProductImage from '@/components/shop/ProductImage';
import Container from '@/components/ui/Container';
import { firePetalBurst } from '@/lib/petal-burst';

interface ProductDetailProps {
  product: Product;
}

export default function ProductDetail({ product }: ProductDetailProps) {
  const { addToCart } = useCart();

  const backHref = product.category === 'flower' ? '/flowers' : '/bouquets';
  const backLabel =
    product.category === 'flower' ? 'Back to Flowers' : 'Back to Bouquets';

  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    addToCart(product);
    const btn = e.currentTarget.getBoundingClientRect();
    const cart = document.getElementById('cart-icon')?.getBoundingClientRect();
    if (cart) {
      firePetalBurst(
        { x: btn.left + btn.width / 2, y: btn.top + btn.height / 2 },
        { x: cart.left + cart.width / 2, y: cart.top + cart.height / 2 }
      );
    }
  };

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="plaque-card grid gap-10 p-6 sm:p-10 lg:grid-cols-2 lg:gap-14">
          {/* Image — half-width hero */}
          <div className="relative aspect-square overflow-hidden bg-[#F9E4E4]/40">
            <ProductImage
              product={product}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority
            />
            {!product.inStock && (
              <div className="absolute inset-0 z-[2] flex items-center justify-center bg-[#FFFAFA]/80">
                <span className="rounded-lg bg-[#4A3B3B] px-4 py-2 font-sans text-sm font-semibold text-white">
                  Out of Stock
                </span>
              </div>
            )}
          </div>

          {/* Specimen label */}
          <div className="flex flex-col">
            <div className="plaque-divider mb-6" />

            <Link
              href={backHref}
              className="mb-4 inline-flex w-fit items-center gap-1 font-sans text-sm font-medium text-[#8B7B7B] transition-colors hover:text-[#D4A5A5]"
            >
              <span aria-hidden="true">←</span>
              {backLabel}
            </Link>

            <h1 className="font-serif text-3xl font-bold text-[#4A3B3B] sm:text-4xl">
              {product.name}
            </h1>

            <p className="mt-3 font-serif text-xl font-bold tabular-nums text-[#4A3B3B]">
              ${formatPrice(product.price)}
            </p>

            {/* Flower type + color pills */}
            {(product.flowerType || product.color) && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {product.flowerType && (
                  <span className="rounded-lg bg-[#F9E4E4] px-3 py-1 font-sans text-sm font-medium text-[#4A3B3B]">
                    {formatLabel(product.flowerType)}
                  </span>
                )}
                {product.color && (
                  <span className="rounded-lg bg-[#FFF5F5] px-3 py-1 font-sans text-sm font-medium text-[#4A3B3B]">
                    {formatLabel(product.color)}
                  </span>
                )}
              </div>
            )}

            <p className="mt-6 font-sans text-base leading-relaxed text-[#8B7B7B]">
              {product.description}
            </p>

            <div className="mt-auto pt-8">
              <Button
                variant="primary"
                size="lg"
                disabled={!product.inStock}
                onClick={handleAddToCart}
              >
                {product.inStock ? 'Add to Cart' : 'Out of Stock'}
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}