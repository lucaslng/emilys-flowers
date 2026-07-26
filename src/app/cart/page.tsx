'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import Container from '@/components/ui/Container';
import Button from '@/components/ui/Button';
import CartItem from '@/components/cart/CartItem';
import CartSummary from '@/components/cart/CartSummary';

/**
 * Reads the `?success=true` query param that Stripe (or the simulated
 * checkout) appends on a successful payment and clears the cart once.
 * Wrapped in <Suspense> because useSearchParams() requires a boundary
 * in Next.js 16 production builds.
 */
function CheckoutSuccessHandler() {
  const searchParams = useSearchParams();
  const { clearCart } = useCart();

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      clearCart();
      // Strip the query param so a refresh or history navigation
      // doesn't re-trigger the handler.
      window.history.replaceState(null, '', '/cart');
    }
    // clearCart is stable (useCallback with [] in CartProvider);
    // run only once on mount.
  }, [searchParams, clearCart]);

  return null;
}

export default function CartPage() {
  const { items, clearCart } = useCart();

  return (
    <>
      <Suspense fallback={null}>
        <CheckoutSuccessHandler />
      </Suspense>
      <div className="py-12 sm:py-16">
      <Container>
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl font-bold text-[#4A3B3B] sm:text-4xl">
            Shopping Cart
          </h1>
          <p className="mt-2 font-sans text-base text-[#8B7B7B]">
            Review and manage your items
          </p>
        </div>

        {items.length === 0 ? (
          /* Empty State */
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-[#F0E0E0] bg-[#FFF5F5] px-6 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 text-[#F0E0E0]"
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
            <h2 className="mt-4 font-serif text-xl font-semibold text-[#4A3B3B]">
              Your cart is empty
            </h2>
            <p className="mt-2 font-sans text-sm text-[#8B7B7B]">
              Looks like you haven&apos;t added any flowers yet.
            </p>
            <Link href="/bouquets" className="mt-6">
              <Button variant="primary">Shop Bouquets</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-sans text-sm text-[#8B7B7B]">
                  {items.reduce((sum, i) => sum + i.quantity, 0)} item
                  {items.reduce((sum, i) => sum + i.quantity, 0) !== 1
                    ? 's'
                    : ''}{' '}
                  in your cart
                </p>
                <button
                  onClick={clearCart}
                  className="font-sans text-sm text-[#8B7B7B] underline transition-colors hover:text-red-500"
                >
                  Clear Cart
                </button>
              </div>
              <div className="space-y-4">
                {items.map((item) => (
                  <CartItem key={item.product.id} item={item} />
                ))}
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
    </>
  );
}
