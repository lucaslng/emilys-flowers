'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { gsap } from '@/lib/gsap';
import { firePetalBurst } from '@/lib/petal-burst';
import Container from '@/components/ui/Container';
import Button from '@/components/ui/Button';
import Reveal from '@/components/ui/Reveal';
import RibbonRose from '@/components/ui/RibbonRose';
import StarMotif from '@/components/ui/StarMotif';
import CartItem from '@/components/cart/CartItem';
import CartSummary from '@/components/cart/CartSummary';
import { prefersReducedMotion } from '@/lib/reduced-motion';

/**
 * CartPageClient — "the gift box, open". Items hang from a dashed string
 * like gift tags on a line. The empty state is an open gift box with a
 * handwritten nudge.
 */
export default function CartPageClient() {
  const { items, clearCart, getItemCount } = useCart();
  const itemsContainerRef = useRef<HTMLDivElement>(null);
  // Holds the in-flight clear timeline so we can kill it on unmount and
  // avoid a stale `onComplete` firing `clearCart` after the user navigates
  // away (which would otherwise wipe a cart the user has since re-populated).
  const clearTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  // Kill the clear timeline if the page unmounts mid-animation.
  useEffect(() => {
    return () => {
      clearTimelineRef.current?.kill();
      clearTimelineRef.current = null;
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

    // On-brand petal scatter: release petals up-and-out from the cart area
    // as it empties. firePetalBurst is itself a no-op under reduced motion,
    // but we already short-circuited above, so this only runs in the
    // full-motion path.
    const rect = itemsContainerRef.current?.getBoundingClientRect();
    if (rect) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      firePetalBurst({ x: cx, y: cy }, { x: cx - 200, y: cy - 220 });
      firePetalBurst({ x: cx, y: cy }, { x: cx + 200, y: cy - 220 });
    }

    // Stagger the items out: fade + slide right + collapse height/margins/
    // padding, then dispatch clearCart() in onComplete so React state and
    // the visual exit stay in sync. Total duration is capped at ~0.5s
    // regardless of item count so a large cart still clears snappy.
    const baseDuration = 0.35;
    const maxTotalDuration = 0.5;
    const stagger = Math.min(
      0.05,
      (maxTotalDuration - baseDuration) / Math.max(nodes.length - 1, 1)
    );
    const tl = gsap.timeline({
      onComplete: () => {
        clearTimelineRef.current = null;
        clearCart();
        setIsClearing(false);
      },
    });
    clearTimelineRef.current = tl;
    tl.to(nodes, {
      opacity: 0,
      x: 40,
      height: 0,
      marginTop: 0,
      marginBottom: 0,
      paddingTop: 0,
      paddingBottom: 0,
      duration: baseDuration,
      ease: 'power2.in',
      stagger,
    });
  };

  const totalQuantity = getItemCount();

  return (
    <div className="relative isolate overflow-hidden py-12 sm:py-16">
      {/* Warm wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 20% 10%, rgba(249, 228, 228, 0.45), rgba(254, 250, 245, 0) 70%)',
        }}
      />

      <Container className="relative z-10">
        <Reveal>
          <div className="mb-10 sm:mb-12">
            <div className="flex items-center gap-3">
              <StarMotif size={36} className="text-rose opacity-80" />
              <h1 className="font-sans text-3xl font-bold uppercase tracking-[0.06em] text-foreground sm:text-4xl">
                Shopping Cart
              </h1>
            </div>
            <p className="mt-3 font-hand text-3xl leading-none text-rose-deep">
              {totalQuantity > 0
                ? `${totalQuantity} ${totalQuantity === 1 ? 'gift' : 'gifts'} being wrapped ♡`
                : 'nothing wrapped yet ♡'}
            </p>
          </div>
        </Reveal>

        {items.length === 0 ? (
          /* Empty State — an open gift box */
          <Reveal>
            <div className="stitch relative flex min-h-[440px] flex-col items-center justify-center bg-surface px-6 py-16 text-center">
              <div
                aria-hidden="true"
                className="wrapping-grid absolute inset-0 opacity-40"
              />
              <div className="relative">
                <RibbonRose size={150} className="mx-auto" />
                {/* Gift-box lid, tilted */}
                <div className="mx-auto -mt-2 h-3 w-44 rotate-[-1.5deg] border border-rose-line/70 bg-blush/80" />
              </div>
              <h2 className="relative mt-8 font-sans text-2xl font-bold uppercase tracking-[0.1em] text-foreground">
                Your cart is empty
              </h2>
              <p className="relative mt-3 max-w-sm font-sans text-sm leading-relaxed text-muted">
                Looks like you haven&apos;t added any flowers yet. The gift
                box is waiting.
              </p>
              <Link href="/bouquets" className="relative mt-8">
                <Button variant="primary">Shop Bouquets</Button>
              </Link>
            </div>
          </Reveal>
        ) : (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-8">
            {/* Cart Items — hanging from a dashed string */}
            <div className="lg:col-span-2">
              {/* The string */}
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

            {/* Summary — the receipt */}
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