'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { formatPrice } from '@/lib/format';
import { formatLabel } from '@/lib/product-utils';
import { Product } from '@/types';
import Button from '@/components/ui/Button';
import ProductImage from '@/components/shop/ProductImage';
import Container from '@/components/ui/Container';
import StarMotif from '@/components/ui/StarMotif';
import { firePetalBurst } from '@/lib/petal-burst';

interface ProductDetailProps {
  product: Product;
}

/**
 * ProductDetail — "the specimen sheet". The flower sits on a tilted
 * wrapping-paper panel (gift-wrap corner fold), and the label beside it
 * reads like a maker's plate: a handwritten category annotation with an
 * arrow, a stamped Martian Mono name, price, tags, and the add-to-cart
 * stamp.
 */
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
    <div className="relative isolate overflow-hidden py-12 sm:py-16">
      {/* Warm vignette */}
      <div aria-hidden="true" className="vignette absolute inset-0" />

      <Container className="relative z-10">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] lg:items-center lg:gap-16">
          {/* Image — tilted wrapping-paper panel with a corner fold */}
          <div className="relative mx-auto w-full max-w-xl">
            <div className="relative rotate-1 border border-border bg-background/90 p-6 backdrop-blur-[1px] sm:p-8">
              {/* Washi tape + wrapping grid */}
              <span aria-hidden="true" className="washi absolute -top-3 left-8 h-6 w-24 -rotate-3" />
              <div aria-hidden="true" className="wrapping-grid absolute inset-0 opacity-60" />

              {/* Gift-wrap corner fold */}
              <div
                aria-hidden="true"
                className="absolute right-0 top-0 h-16 w-16"
                style={{
                  background:
                    'linear-gradient(225deg, rgba(212, 165, 165, 0.35) 0%, rgba(212, 165, 165, 0.12) 45%, transparent 46%)',
                }}
              />

              <div className="relative aspect-square overflow-hidden bg-blush/30">
                <ProductImage
                  product={product}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  priority
                />
                {!product.inStock && (
                  <div className="absolute inset-0 z-[2] flex items-center justify-center bg-background/80">
                    <span className="border border-rose-line bg-foreground px-4 py-2 font-sans text-sm font-semibold uppercase tracking-[0.12em] text-background">
                      Out of Stock
                    </span>
                  </div>
                )}
              </div>
            </div>
            <StarMotif
              size={56}
              className="animate-star absolute -right-4 -top-4 text-rose opacity-80"
            />
          </div>

          {/* Specimen label */}
          <div className="relative">
            <Link
              href={backHref}
              className="mb-5 inline-flex w-fit items-center gap-1 font-sans text-xs font-medium uppercase tracking-[0.18em] text-muted transition-colors hover:text-rose-deep"
            >
              <span aria-hidden="true">←</span>
              {backLabel}
            </Link>

            {/* Handwritten category annotation with arrow */}
            <div className="flex items-center gap-2">
              <svg aria-hidden="true" width="72" height="24" viewBox="0 0 72 24" fill="none" className="text-rose-line">
                <path d="M4 20 C 24 16 46 8 68 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
                <path d="M68 5 L 59 4 M 68 5 L 64 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
              </svg>
              <span className="font-hand text-3xl leading-none text-rose-deep">
                {product.flowerType
                  ? formatLabel(product.flowerType)
                  : product.category === 'flower'
                    ? 'a single bloom'
                    : 'a gathered bouquet'}
              </span>
            </div>

            <h1 className="mt-3 font-sans text-3xl font-bold uppercase leading-[1.1] tracking-[0.05em] text-foreground sm:text-4xl">
              {product.name}
            </h1>

            <p className="mt-4 font-sans text-2xl font-bold tabular-nums text-foreground">
              ${formatPrice(product.price)}
            </p>

            {/* Flower type + color stamps */}
            {(product.flowerType || product.color) && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {product.flowerType && (
                  <span className="border border-rose-line/60 bg-blush/70 px-3 py-1 font-sans text-xs font-medium uppercase tracking-[0.12em] text-foreground">
                    {formatLabel(product.flowerType)}
                  </span>
                )}
                {product.color && (
                  <span className="border border-border bg-surface px-3 py-1 font-sans text-xs font-medium uppercase tracking-[0.12em] text-foreground">
                    {formatLabel(product.color)}
                  </span>
                )}
              </div>
            )}

            <p className="mt-6 max-w-md font-sans text-base leading-relaxed text-muted">
              {product.description}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Button
                variant="primary"
                size="lg"
                disabled={!product.inStock}
                onClick={handleAddToCart}
              >
                {product.inStock ? 'Add to Cart' : 'Out of Stock'}
              </Button>
              <span className="font-hand text-2xl leading-none text-rose-deep">
                hand-folded, just for you ♡
              </span>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}