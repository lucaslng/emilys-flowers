'use client';

// /checkout/success
//
// Shown after a completed Stripe Checkout (or the simulated checkout path used
// in local dev / E2E). The checkout API redirects here with two query params:
//
//   ?success=true&order=<EF-XXXXXX | cs_test_...>&items=<base64url LineItem[]>
//
// We decode `items` back into the line-item list (see `src/lib/order.ts`), show
// a warm confirmation + an order summary that mirrors `/checkout`, clear the
// cart (the order is already placed), and celebrate with a small petal burst
// from the confirmation seal.
//
// `useSearchParams()` is wrapped in <Suspense> per Next.js 16's static-render
// requirement (the fallback is a branded BloomSpinner placeholder).

import { Suspense, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { gsap, useGSAP } from '@/lib/gsap';
import { firePetalBurst } from '@/lib/petal-burst';
import { decodeOrderItems, computeLineItemTotal, computeLineItemCount, computeShipping, type LineItem } from '@/lib/order';
import { formatPrice } from '@/lib/format';
import { getProductById } from '@/lib/products';
import { useCart } from '@/lib/cart-context';
import Container from '@/components/ui/Container';
import Button from '@/components/ui/Button';
import BloomSpinner from '@/components/ui/BloomSpinner';
import SquiggleUnderline from '@/components/ui/SquiggleUnderline';

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const { clearCart } = useCart();
  const root = useRef<HTMLDivElement>(null);
  const sealRef = useRef<HTMLDivElement>(null);

  const order = searchParams.get('order') ?? '';
  const encodedItems = searchParams.get('items') ?? '';
  const items: LineItem[] = decodeOrderItems(encodedItems);
  const hasItems = items.length > 0;

  // The order is already placed — clear the cart once on mount.
  useEffect(() => {
    clearCart();
  }, [clearCart]);

  // Orchestrated mount reveal: one staggered timeline across every
  // [data-reveal] section (seal → heading → subtitle → pill → summary →
  // line items → totals → CTAs → reassurance), plus a three-wave petal
  // burst released downward from the confirmation seal. Reduced motion
  // skips the timeline + the burst (firePetalBurst also no-ops on its own).
  useGSAP(
    () => {
      const scope = root.current;
      if (!scope) return;
      const reveals = gsap.utils.toArray<HTMLElement>(
        scope.querySelectorAll('[data-reveal]')
      );
      if (reveals.length === 0) return;

      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          reveals,
          { opacity: 0, y: 16 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: 'power2.out',
            stagger: 0.1,
            delay: 0.15,
          }
        );

        // Petal celebration: the seal "blooms" and releases three staggered
        // waves of petals that drift down over the receipt. Viewport coords
        // (the petal layer is position: fixed).
        const seal = sealRef.current;
        if (seal) {
          const r = seal.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const vw = window.innerWidth;
          const drop = 220;
          const targets = [
            { x: cx, y: cy + drop },
            { x: Math.max(cx - 160, 24), y: cy + drop - 40 },
            { x: Math.min(cx + 160, vw - 24), y: cy + drop - 40 },
          ];
          targets.forEach((t, i) => {
            gsap.delayedCall(0.35 + i * 0.2, () => {
              firePetalBurst({ x: cx, y: cy }, t);
            });
          });
        }
      });
      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(reveals, { opacity: 1, y: 0, clearProps: 'transform,opacity' });
      });
    },
    { scope: root, dependencies: [] }
  );

  const subtotal = computeLineItemTotal(items);
  const shipping = computeShipping(subtotal);
  const total = subtotal + shipping;
  const itemCount = computeLineItemCount(items);

  return (
    <div ref={root} className="mx-auto max-w-2xl">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="text-center">
        {/* Confirmation seal — a slow-turning floral emblem. */}
        <div ref={sealRef} data-reveal className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#F0E0E0] bg-[#FFF5F5]">
            <BloomSpinner size={48} color="#D4A5A5" />
          </div>
        </div>

        <div data-reveal className="mt-6">
          <h1 className="font-serif text-3xl font-bold text-[#4A3B3B] sm:text-4xl">
            Thank you for your order
          </h1>
          <SquiggleUnderline className="mx-auto mt-3 block" width={140} />
        </div>

        <p
          data-reveal
          className="mx-auto mt-5 max-w-md font-sans text-base text-[#8B7B7B]"
        >
          {hasItems
            ? 'Your handcrafted blooms are being prepared with care. A confirmation is on its way to your inbox.'
            : 'Your order has been received. We are preparing your handcrafted blooms — a confirmation is on its way to your inbox shortly.'}
        </p>

        {order && (
          <div
            data-reveal
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#F0E0E0] bg-[#FFF5F5] px-4 py-1.5"
          >
            <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-[#8B7B7B]">
              Order
            </span>
            <span
              className="max-w-[220px] truncate font-serif text-sm font-semibold text-[#4A3B3B]"
              title={order}
            >
              #{order}
            </span>
          </div>
        )}
      </div>

      {/* ── Order Summary (only when line items are present) ─────── */}
      {hasItems && (
        <div
          data-reveal
          className="mt-10 rounded-xl border border-[#F0E0E0] bg-[#FFFAFA] p-6"
        >
          <h2 className="font-serif text-xl font-semibold text-[#4A3B3B]">
            Order Summary
          </h2>

          <div className="mt-4 divide-y divide-[#F0E0E0]">
            {items.map((item) => {
              const product = getProductById(item.id);
              return (
                <div
                  key={item.id}
                  data-reveal
                  className="flex items-center gap-4 py-4"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden border border-[#F0E0E0] bg-[#F9E4E4]/40">
                    {product ? (
                      <Image
                        src={product.images[0]}
                        alt={item.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-serif text-xl text-[#D4A5A5]">
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-sm font-medium text-[#4A3B3B]">
                      {item.name}
                    </p>
                    <p className="font-sans text-xs text-[#8B7B7B]">
                      Qty {item.quantity}
                    </p>
                  </div>
                  <span className="font-sans text-sm font-medium tabular-nums text-[#4A3B3B]">
                    {`$${formatPrice(item.price * item.quantity)}`}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            data-reveal
            className="mt-4 space-y-2 border-t border-[#F0E0E0] pt-4"
          >
            <div className="flex justify-between font-sans text-sm text-[#4A3B3B]">
              <span>
                Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})
              </span>
              <span>{`$${formatPrice(subtotal)}`}</span>
            </div>
            <div className="flex justify-between font-sans text-sm text-[#4A3B3B]">
              <span>Shipping</span>
              <span>
                {shipping === 0 ? (
                  <span className="text-green-700">Free</span>
                ) : (
                  `$${formatPrice(shipping)}`
                )}
              </span>
            </div>
            <div className="flex justify-between border-t border-[#F0E0E0] pt-2 font-serif text-lg font-bold text-[#4A3B3B]">
              <span>Total</span>
              <span>{`$${formatPrice(total)}`}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── CTAs ─────────────────────────────────────────────────── */}
      <div
        data-reveal
        className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
      >
        <Link href="/bouquets">
          <Button variant="primary" size="lg">
            Continue Shopping
          </Button>
        </Link>
        <Link href="/">
          <Button variant="secondary" size="lg">
            Back to Home
          </Button>
        </Link>
      </div>

      {/* ── Reassurance ──────────────────────────────────────────── */}
      <p
        data-reveal
        className="mt-8 text-center font-sans text-sm text-[#8B7B7B]"
      >
        Each bloom is handcrafted to order. Your confirmation and shipping
        details are on their way to your email.
      </p>
    </div>
  );
}

function SuccessFallback() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
      <BloomSpinner size={56} color="#D4A5A5" />
      <p className="mt-4 font-sans text-sm text-[#8B7B7B]">
        Loading your order…
      </p>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <div className="py-12 sm:py-16">
      <Container>
        <Suspense fallback={<SuccessFallback />}>
          <CheckoutSuccessContent />
        </Suspense>
      </Container>
    </div>
  );
}