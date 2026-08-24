'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { useCart } from '@/lib/cart-context';
import Button from '@/components/ui/Button';
import Reveal from '@/components/ui/Reveal';
import OrderReceipt from '@/components/order/OrderReceipt';
import { useScaleBump } from '@/lib/use-scale-bump';

// Shipping is calculated at checkout, so the total here is the items subtotal.
export default function CartSummary() {
  const { getTotal, getItemCount } = useCart();
  const subtotal = getTotal();
  const itemCount = getItemCount();

  const rootRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef<HTMLSpanElement>(null);

  useScaleBump(subtotal, [totalRef], rootRef);

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