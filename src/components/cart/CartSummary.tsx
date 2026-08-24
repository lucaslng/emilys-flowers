'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { gsap, useGSAP } from '@/lib/gsap';
import Button from '@/components/ui/Button';
import Reveal from '@/components/ui/Reveal';
import OrderReceipt from '@/components/order/OrderReceipt';
import { prefersReducedMotion } from '@/lib/reduced-motion';

/**
 * CartSummary — "the receipt". A stitched receipt card with a dashed seam
 * under the heading. Shipping is calculated at checkout, so the total here
 * is the items subtotal.
 */
export default function CartSummary() {
  const { getTotal, getItemCount } = useCart();
  const subtotal = getTotal();
  const itemCount = getItemCount();

  const rootRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef<HTMLSpanElement>(null);
  // Skips the bump on the initial mount (only react to real changes).
  const isFirstRun = useRef(true);

  // Cost-number micro-interaction: a subtle scale bump on the Total
  // whenever it changes. No-op under reduced motion and on first render.
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
    { dependencies: [subtotal], scope: rootRef }
  );

  return (
    <Reveal delay={0.1}>
      <div ref={rootRef} className="stitch relative bg-surface p-6">
        <OrderReceipt
          dividerClassName="-mx-6 mt-4"
          totalsClassName="mt-6 space-y-3"
          subtotalLabel={`Items (${itemCount})`}
          subtotal={subtotal}
          total={subtotal}
          totalRowWrapperClassName="gift-divider pt-3"
          totalRowClassName="flex justify-between font-sans text-lg font-bold uppercase tracking-[0.1em] text-foreground"
          totalValueRef={totalRef}
        />

        <Link href="/checkout" className="mt-6 block">
          <Button variant="primary" fullWidth>
            Proceed to Checkout
          </Button>
        </Link>

        <Link
          href="/bouquets"
          className="mt-3 block text-center font-sans text-sm text-muted underline decoration-rose-line/50 underline-offset-4 transition-colors hover:text-rose-deep hover:decoration-rose-deep"
        >
          Continue Shopping
        </Link>
      </div>
    </Reveal>
  );
}