'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { gsap } from '@/lib/gsap';
import { firePetalBurst } from '@/lib/petal-burst';
import Container from '@/components/ui/Container';
import Button from '@/components/ui/Button';
import Reveal from '@/components/ui/Reveal';
import SquiggleUnderline from '@/components/ui/SquiggleUnderline';
import CartItem from '@/components/cart/CartItem';
import CartSummary from '@/components/cart/CartSummary';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function CartPage() {
  const { items, clearCart } = useCart();
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
    // the visual exit stay in sync. Total duration stays well under 500ms
    // even for a few items (0.35s + 0.05s * (n-1)) so Playwright won't flake.
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
      duration: 0.35,
      ease: 'power2.in',
      stagger: 0.05,
    });
  };

  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <Reveal>
          <div className="mb-10 text-center sm:mb-12">
            <h1 className="font-serif text-3xl font-bold text-[#4A3B3B] sm:text-4xl">
              Shopping Cart
            </h1>
            <p className="mt-2 font-sans text-base text-[#8B7B7B]">
              Review and manage your items
            </p>
            <div className="mt-2 flex justify-center">
              <SquiggleUnderline />
            </div>
          </div>
        </Reveal>

        {items.length === 0 ? (
          /* Empty State — plaque frame + specimen-mount icon */
          <Reveal>
            <div className="flex min-h-[420px] flex-col items-center justify-center border border-[#F0E0E0] bg-[#FFF5F5] px-6 py-16 text-center">
              <div
                className="flex h-24 w-24 items-center justify-center border border-[#F0E0E0] bg-[#FFFAFA]"
                aria-hidden="true"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 text-[#D4A5A5]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                  />
                </svg>
              </div>
              <h2 className="mt-8 font-serif text-2xl font-semibold text-[#4A3B3B]">
                Your cart is empty
              </h2>
              <div className="mt-3 flex justify-center">
                <SquiggleUnderline />
              </div>
              <p className="mt-4 max-w-sm font-sans text-sm text-[#8B7B7B]">
                Looks like you haven&apos;t added any flowers yet.
              </p>
              <Link href="/bouquets" className="mt-8">
                <Button variant="primary">Shop Bouquets</Button>
              </Link>
            </div>
          </Reveal>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="mb-5 flex items-center justify-between">
                <p className="font-sans text-sm text-[#8B7B7B]">
                  {totalQuantity} item{totalQuantity !== 1 ? 's' : ''} in your cart
                </p>
                <button
                  onClick={handleClearCart}
                  disabled={isClearing}
                  className="font-sans text-sm text-[#8B7B7B] underline decoration-[#E0CFCF] underline-offset-4 transition-colors hover:text-[#A8625A] hover:decoration-[#A8625A] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear Cart
                </button>
              </div>
              <div ref={itemsContainerRef}>
                <Reveal stagger className="space-y-4">
                  {items.map((item) => (
                    <CartItem key={item.product.id} item={item} />
                  ))}
                </Reveal>
              </div>
            </div>

            {/* Summary */}
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