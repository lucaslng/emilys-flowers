'use client';

import { useCart } from '@/lib/cart-context';
import { formatCAD } from '@/lib/format';
import { formatLabel } from '@/lib/product-utils';
import { Product } from '@/types';
import Button from '@/components/ui/Button';
import ProductGallery from '@/components/shop/ProductGallery';
import ArrowFlourish from '@/components/shop/ArrowFlourish';
import Breadcrumb, { type Crumb } from '@/components/shop/Breadcrumb';
import Container from '@/components/ui/Container';
import StarMotif from '@/components/ui/StarMotif';
import { addWithPetalBurst } from '@/lib/petal-burst';

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

  const categoryHref = product.category === 'flower' ? '/flowers' : '/bouquets';
  const crumbs: Crumb[] = [
    { name: 'Home', href: '/' },
    {
      name: product.category === 'flower' ? 'Flowers' : 'Bouquets',
      href: categoryHref,
    },
    { name: product.name },
  ];

  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    addToCart(product);
    addWithPetalBurst(e.currentTarget);
  };

  return (
    <div className="relative isolate overflow-hidden py-12 sm:py-16">
      <div aria-hidden="true" className="vignette absolute inset-0" />

      <Container className="relative z-10">
        <Breadcrumb items={crumbs} className="mb-10 sm:mb-12" />
        <div className="grid gap-12 lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] lg:items-center lg:gap-16">
          <div className="relative mx-auto w-full max-w-xl">
            <div className="relative rotate-1 border border-border bg-background/90 p-6 backdrop-blur-[1px] sm:p-8">
              <span aria-hidden="true" className="washi absolute -top-3 left-8 h-6 w-24 -rotate-3" />
              <div aria-hidden="true" className="wrapping-grid absolute inset-0 opacity-60" />

              <div
                aria-hidden="true"
                className="absolute right-0 top-0 h-16 w-16"
                style={{
                  background:
                    'linear-gradient(225deg, rgba(212, 165, 165, 0.35) 0%, rgba(212, 165, 165, 0.12) 45%, transparent 46%)',
                }}
              />

              <ProductGallery
                product={product}
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            </div>
            <StarMotif
              size={56}
              className="animate-star absolute -right-4 -top-4 text-rose opacity-80"
            />
          </div>

          <div className="relative">
            <div className="flex items-center gap-2">
              <ArrowFlourish size="md" />
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
              {formatCAD(product.price)}
            </p>

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