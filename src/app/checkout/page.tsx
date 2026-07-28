'use client';

import { useState } from 'react';
import { useCart, toLineItems } from '@/lib/cart-context';
import { computeShipping } from '@/lib/order';
import { formatPrice } from '@/lib/format';
import Container from '@/components/ui/Container';
import Button from '@/components/ui/Button';
import Link from 'next/link';

export default function CheckoutPage() {
  const { items, getTotal, getItemCount } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const subtotal = getTotal();
  const shipping = computeShipping(subtotal);
  const total = subtotal + shipping;

  const handleCheckout = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: toLineItems(items),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="py-12 sm:py-16">
        <Container>
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-[#F0E0E0] bg-[#FFF5F5] px-6 text-center">
            <h1 className="font-serif text-2xl font-bold text-[#4A3B3B]">
              Your cart is empty
            </h1>
            <p className="mt-2 font-sans text-sm text-[#8B7B7B]">
              Add some items to your cart before checking out.
            </p>
            <Link href="/bouquets" className="mt-6">
              <Button variant="primary">Shop Bouquets</Button>
            </Link>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="font-serif text-3xl font-bold text-[#4A3B3B] sm:text-4xl">
              Checkout
            </h1>
            <p className="mt-2 font-sans text-base text-[#8B7B7B]">
              Review your order and proceed to payment
            </p>
          </div>

          {/* Order Summary */}
          <div className="rounded-xl border border-[#F0E0E0] bg-[#FFFAFA] p-6">
            <h2 className="font-serif text-xl font-semibold text-[#4A3B3B]">
              Order Summary
            </h2>

            <div className="mt-4 divide-y divide-[#F0E0E0]">
              {items.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex-1">
                    <p className="font-sans text-sm font-medium text-[#4A3B3B]">
                      {item.product.name}
                    </p>
                    <p className="font-sans text-xs text-[#8B7B7B]">
                      Qty: {item.quantity}
                    </p>
                  </div>
                  <span className="font-sans text-sm font-medium text-[#4A3B3B]">
                    {formatPrice(item.product.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2 border-t border-[#F0E0E0] pt-4">
              <div className="flex justify-between font-sans text-sm text-[#4A3B3B]">
                <span>
                  Subtotal ({getItemCount()} item
                  {getItemCount() !== 1 ? 's' : ''})
                </span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between font-sans text-sm text-[#4A3B3B]">
                <span>Shipping</span>
                <span>
                  {shipping === 0 ? (
                    <span className="text-green-700">Free</span>
                  ) : (
                    {formatPrice(shipping)}
                  )}
                </span>
              </div>
              <div className="flex justify-between border-t border-[#F0E0E0] pt-2 font-serif text-lg font-bold text-[#4A3B3B]">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Button */}
          <div className="mt-8">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 font-sans text-sm text-red-700">
                {error}
              </div>
            )}
            <Button
              variant="primary"
              fullWidth
              onClick={handleCheckout}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Processing...
                </span>
              ) : (
                'Pay with Stripe'
              )}
            </Button>
            <p className="mt-3 text-center font-sans text-xs text-[#8B7B7B]">
              You will be redirected to Stripe&apos;s secure checkout to
              complete your payment.
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}
