'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/lib/cart-context';
import { collapseAndRemove, gsap } from '@/lib/gsap';
import { firePetalBurst } from '@/lib/petal-burst';
import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import BouquetSticker from '@/components/ui/BouquetSticker';
import StarMotif from '@/components/ui/StarMotif';
import ArrowFlourish from '@/components/shop/ArrowFlourish';
import PageWash from '@/components/ui/PageWash';
import CartItem from '@/components/cart/CartItem';
import CartSummary from '@/components/cart/CartSummary';
import EmptyCartCard from '@/components/cart/EmptyCartCard';
import { prefersReducedMotion } from '@/lib/reduced-motion';

export default function CartPageClient() {
  const { items, clearCart, getItemCount } = useCart();
  const itemsContainerRef = useRef<HTMLDivElement>(null);
  // Kill the in-flight clear tween on unmount so a stale `onComplete` can't
  // wipe a cart the user has since re-populated after navigating away.
  const clearTweenRef = useRef<gsap.core.Tween | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    return () => {
      clearTweenRef.current?.kill();
      clearTweenRef.current = null;
    };
  }, []);

  const handleClearCart = () => {
    if (isClearing) return;
    const nodes = gsap.utils.toArray<HTMLElement>(
      itemsContainerRef.current?.querySelectorAll('[data-cart-item]') ?? []
    );
    // Reduced motion or nothing to animate: clear immediately.
    if (nodes.length === 0 || prefersReducedMotion()) {
      clearCart();
      return;
    }
    setIsClearing(true);

    const rect = itemsContainerRef.current?.getBoundingClientRect();
    if (rect) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      firePetalBurst({ x: cx, y: cy }, { x: cx - 200, y: cy - 220 });
      firePetalBurst({ x: cx, y: cy }, { x: cx + 200, y: cy - 220 });
    }

    // Stagger the items out, then clearCart() in onComplete so React state
    // and the visual exit stay in sync. Capped at ~0.5s so a large cart
    // still clears snappy.
    const maxTotalDuration = 0.5;
    const stagger = Math.min(
      0.05,
      (maxTotalDuration - 0.35) / Math.max(nodes.length - 1, 1)
    );
    clearTweenRef.current = collapseAndRemove(
      nodes,
      () => {
        clearTweenRef.current = null;
        clearCart();
        setIsClearing(false);
      },
      { stagger }
    );
  };

  const totalQuantity = getItemCount();

  return (
    <div className="relative isolate overflow-hidden py-12 sm:py-16">
      <PageWash background="radial-gradient(ellipse 50% 40% at 20% 10%, rgba(249, 228, 228, 0.45), rgba(254, 250, 245, 0) 70%)" />

      <Container className="relative z-10">
        <Reveal>
          <div className="mb-10 sm:mb-12">
            <div className="flex items-center gap-3">
              <StarMotif size={36} className="text-rose opacity-80" />
              <h1 className="font-sans text-3xl font-bold uppercase tracking-[0.06em] text-foreground sm:text-4xl">
                Shopping Cart
              </h1>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <ArrowFlourish />
              <span className="font-hand text-3xl leading-none text-rose-deep">
                {totalQuantity > 0
                  ? `${totalQuantity} ${totalQuantity === 1 ? 'gift' : 'gifts'} being wrapped ♡`
                  : 'nothing wrapped yet ♡'}
              </span>
            </div>
          </div>
        </Reveal>

        {items.length === 0 ? (
          <Reveal>
            <EmptyCartCard
              className="min-h-[440px] py-16"
              motif={
                <>
                  <div
                    aria-hidden="true"
                    className="wrapping-grid absolute inset-0 opacity-40"
                  />
                  <div className="relative">
                    <BouquetSticker size={150} className="mx-auto" />
                  </div>
                </>
              }
              titleClassName="relative mt-8 font-sans text-2xl font-bold uppercase tracking-[0.1em] text-foreground"
              message={
                <>
                  Looks like you haven&apos;t added any flowers yet. The gift
                  box is waiting.
                </>
              }
              messageClassName="relative mt-3 max-w-sm font-sans text-sm leading-relaxed text-muted"
              ctaHref="/bouquets"
              ctaLabel="Shop Bouquets"
              ctaClassName="relative mt-8"
            />
          </Reveal>
        ) : (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-8">
            <div className="lg:col-span-2">
              <div aria-hidden="true" className="mb-8 border-t border-dashed border-rose-line/50" />
              <div className="mb-5 flex items-center justify-between">
                <p className="font-sans text-sm text-muted">
                  {totalQuantity} item{totalQuantity !== 1 ? 's' : ''} in your cart
                </p>
                <button
                  onClick={handleClearCart}
                  disabled={isClearing}
                  className="py-1 font-sans text-sm text-muted underline decoration-rose-line/50 underline-offset-4 transition-colors hover:text-rose-deep hover:decoration-rose-deep disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear Cart
                </button>
              </div>
              <div ref={itemsContainerRef}>
                <Reveal stagger className="space-y-5">
                  {items.map((item) => (
                    <CartItem key={item.product.id} item={item} />
                  ))}
                </Reveal>
              </div>
            </div>

            <div>
              <div className="sticky top-24">
                <CartSummary />
              </div>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}