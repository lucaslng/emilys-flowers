'use client';

import { useState } from 'react';
import { useCart, toLineItems } from '@/lib/cart-context';
import { computeShipping } from '@/lib/order';
import { formatPrice } from '@/lib/format';
import Container from '@/components/ui/Container';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import StarMotif from '@/components/ui/StarMotif';

/**
 * CheckoutPageClient — "the wrapping desk". The order summary reads like a
 * store receipt (stitched edges, dashed seams) and the payment button is a
 * big stamp. All checkout behaviour is unchanged.
 */
export default function CheckoutPageClient() {
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
          <div className="stitch relative flex min-h-[400px] flex-col items-center justify-center bg-surface px-6 text-center">
            <StarMotif size={48} className="text-rose opacity-80" />
            <h1 className="mt-6 font-sans text-2xl font-bold uppercase tracking-[0.1em] text-foreground">
              Your cart is empty
            </h1>
            <p className="mt-2 font-sans text-sm text-muted">
              Nothing to wrap yet — add some blooms and come back.
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
    <div className="relative isolate overflow-hidden py-12 sm:py-16">
      {/* Warm wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 80% 10%, rgba(243, 228, 211, 0.55), rgba(243, 228, 211, 0) 70%)',
        }}
      />

      <Container className="relative z-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-10 text-center">
            <StarMotif size={44} className="mx-auto text-rose opacity-80" />
            <h1 className="mt-4 font-sans text-3xl font-bold uppercase tracking-[0.06em] text-foreground sm:text-4xl">
              Checkout
            </h1>
            <p className="mt-2 font-hand text-3xl leading-none text-rose-deep">
              almost wrapped ♡
            </p>
          </div>

          {/* Order Summary — the receipt */}
          <div className="stitch relative bg-background p-6 sm:p-8">
            <h2 className="font-sans text-lg font-bold uppercase tracking-[0.14em] text-foreground">
              Order Summary
            </h2>
            <div className="gift-divider mt-4" />

            <div className="mt-4 divide-y divide-dashed divide-rose-line/30">
              {items.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex-1">
                    <p className="font-sans text-sm font-medium uppercase tracking-[0.06em] text-foreground">
                      {item.product.name}
                    </p>
                    <p className="font-sans text-xs text-muted">
                      Qty: {item.quantity}
                    </p>
                  </div>
                  <span className="font-sans text-sm font-medium tabular-nums text-foreground">
                    ${formatPrice(item.product.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2 border-t border-dashed border-rose-line/40 pt-4">
              <div className="flex justify-between font-sans text-sm text-foreground">
                <span>
                  Subtotal ({getItemCount()} item
                  {getItemCount() !== 1 ? 's' : ''})
                </span>
                <span className="tabular-nums">${formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between font-sans text-sm text-foreground">
                <span>Shipping</span>
                <span className="tabular-nums">
                  {shipping === 0 ? (
                    <span className="font-semibold text-rose-deep">Free</span>
                  ) : (
                    `$${formatPrice(shipping)}`
                  )}
                </span>
              </div>
              <div className="flex justify-between border-t border-dashed border-rose-line/40 pt-2 font-sans text-lg font-bold uppercase tracking-[0.1em] text-foreground">
                <span>Total</span>
                <span className="tabular-nums">${formatPrice(total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Button — the stamp */}
          <div className="mt-8">
            {error && (
              <div
                role="alert"
                className="mb-4 border border-[#E8C4B4] bg-[#FDF0EA] p-4 font-sans text-sm text-[#9C4A2F]"
              >
                {error}
              </div>
            )}
            <Button
              variant="primary"
              fullWidth
              onClick={handleCheckout}
              disabled={loading}
              aria-busy={loading}
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
            <p className="mt-3 text-center font-sans text-xs text-muted">
              You will be redirected to Stripe&apos;s secure checkout to
              complete your payment.
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}