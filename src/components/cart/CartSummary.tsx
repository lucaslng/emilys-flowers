'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import Button from '@/components/ui/Button';
import Reveal from '@/components/ui/Reveal';

export default function CartSummary() {
  const { items, getTotal, getItemCount } = useCart();
  const subtotal = getTotal();
  const itemCount = getItemCount();
  const shipping = subtotal >= 5000 ? 0 : 599;
  const total = subtotal + shipping;

  return (
    <Reveal delay={0.1}>
      <div className="border border-[#F0E0E0] bg-[#FFF5F5] p-6">
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
            <span className="tabular-nums">${(subtotal / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-sans text-sm text-[#4A3B3B]">
            <span>Shipping</span>
            <span className="tabular-nums">
              {shipping === 0 ? (
                <span className="text-green-700">Free</span>
              ) : (
                `$${(shipping / 100).toFixed(2)}`
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
              <span className="tabular-nums">${(total / 100).toFixed(2)}</span>
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