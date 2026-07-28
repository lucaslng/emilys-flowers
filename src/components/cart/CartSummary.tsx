'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { computeShipping } from '@/lib/order';
import { formatPrice } from '@/lib/format';
import { gsap, useGSAP } from '@/lib/gsap';
import Button from '@/components/ui/Button';
import Reveal from '@/components/ui/Reveal';
import { prefersReducedMotion } from '@/lib/reduced-motion';

export default function CartSummary() {
  const { items, getTotal, getItemCount } = useCart();
  const subtotal = getTotal();
  const itemCount = getItemCount();
  const shipping = computeShipping(subtotal);
  const total = subtotal + shipping;

  const rootRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef<HTMLSpanElement>(null);
  // Skips the bump on the initial mount (only react to real changes).
  const isFirstRun = useRef(true);

  // Cost-number micro-interaction: a subtle scale bump on the Total
  // whenever it changes — which happens both when a quantity changes
  // and when an item is removed (the row's exit tween completes, the
  // context updates, and this fires). No-op under reduced motion and
  // on the first render. Mirrors the quantity-bump in CartItem.
  useGSAP(
    () => {
      if (isFirstRun.current) {
        isFirstRun.current = false;
        return;
      }
      if (prefersReducedMotion() || !totalRef.current) return;
      gsap.fromTo(
        totalRef.current,
        { scale: 1 },
        {
          scale: 1.12,
          duration: 0.12,
          ease: 'power2.out',
          yoyo: true,
          repeat: 1,
        }
      );
    },
    { dependencies: [total], scope: rootRef }
  );

  return (
    <Reveal delay={0.1}>
      <div ref={rootRef} className="border border-[#F0E0E0] bg-[#FFF5F5] p-6">
        <h2 className="font-serif text-xl font-semibold text-[#4A3B3B]">
          Order Summary
        </h2>
        {/* Edge-to-edge hairline divider under the heading (specimen-label feel) */}
        <div className="plaque-divider -mx-6 mt-4" />

        <div className="mt-6 space-y-3">
          <div className="flex justify-between font-sans text-sm text-[#4A3B3B]">
            <span>
              Items ({itemCount})
            </span>
            <span className="tabular-nums">${formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between font-sans text-sm text-[#4A3B3B]">
            <span>Shipping</span>
            <span className="tabular-nums">
              {shipping === 0 ? (
                <span className="text-green-700">Free</span>
              ) : (
                `$${formatPrice(shipping)}`
              )}
            </span>
          </div>
          {shipping > 0 && (
            <p className="font-sans text-xs text-[#8B7B7B]">
              Free shipping on orders over $50.00
            </p>
          )}
          <div className="plaque-divider pt-3">
            <div className="flex justify-between font-serif text-lg font-bold text-[#4A3B3B]">
              <span>Total</span>
              <span ref={totalRef} className="tabular-nums">${formatPrice(total)}</span>
            </div>
          </div>
        </div>

        <Link href="/checkout" className="mt-6 block">
          <Button variant="primary" fullWidth>
            Proceed to Checkout
          </Button>
        </Link>

        <Link
          href="/bouquets"
          className="mt-3 block text-center font-sans text-sm text-[#8B7B7B] underline transition-colors hover:text-[#D4A5A5]"
        >
          Continue Shopping
        </Link>
      </div>
    </Reveal>
  );
}