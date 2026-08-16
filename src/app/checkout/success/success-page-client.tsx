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
import { useSearchParams } from 'next/navigation';
import { gsap, useGSAP } from '@/lib/gsap';
import { firePetalBurst } from '@/lib/petal-burst';
import { decodeOrderItems, computeLineItemTotal, computeLineItemCount, computeShipping, type LineItem } from '@/lib/order';
import { formatPrice } from '@/lib/format';
import { useCart } from '@/lib/cart-context';
import Container from '@/components/ui/Container';
import Button from '@/components/ui/Button';
import BloomSpinner from '@/components/ui/BloomSpinner';
import StarMotif from '@/components/ui/StarMotif';

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
      {/* ── Hero — the thank-you card ─────────────────────────────── */}
      <div className="relative text-center">
        <StarMotif size={40} className="mx-auto text-rose opacity-70" />
        {/* Confirmation seal — a slow-turning floral emblem inside a
            hand-drawn dashed ring that boils like a hand-stamped circle. */}
        <div ref={sealRef} data-reveal className="mt-4 flex flex-col items-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-surface">
            <svg
              aria-hidden="true"
              className="line-boil-fine absolute inset-0 h-full w-full text-rose-line"
              viewBox="0 0 80 80"
              fill="none"
            >
              <circle
                cx="40"
                cy="40"
                r="37.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="7 6"
                strokeLinecap="round"
              />
            </svg>
            <BloomSpinner size={48} color="#D4A5A5" />
          </div>
          {/* Hand-drawn arrow pointing at the heading */}
          <svg
            aria-hidden="true"
            width="20"
            height="34"
            viewBox="0 0 20 34"
            fill="none"
            className="line-boil-fine mt-2 text-rose-line"
          >
            <path d="M10 2 C 12 12 8 22 10 30" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
            <path d="M10 30 L 4 22 M 10 30 L 16 22" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
          </svg>
        </div>

        <div data-reveal className="mt-6">
          <h1 className="font-sans text-3xl font-bold uppercase tracking-[0.06em] text-foreground sm:text-4xl">
            Thank you for your order
          </h1>
          <p className="mt-3 font-hand text-3xl leading-none text-rose-deep">
            it&rsquo;s on its way ♡
          </p>
        </div>

        <p
          data-reveal
          className="mx-auto mt-5 max-w-md font-sans text-base leading-relaxed text-muted"
        >
          {hasItems
            ? 'Your handcrafted blooms are being prepared with care. A confirmation is on its way to your inbox.'
            : 'Your order has been received. We are preparing your handcrafted blooms — a confirmation is on its way to your inbox shortly.'}
        </p>

        {order && (
          <div
            data-reveal
            className="mt-6 inline-flex items-center gap-2 border border-border bg-surface px-4 py-1.5"
          >
            <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted">
              Order
            </span>
            <span
              className="max-w-[220px] truncate font-sans text-sm font-semibold tracking-[0.08em] text-foreground"
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
          className="stitch relative mt-10 bg-background p-6 sm:p-8"
        >
          <h2 className="font-sans text-lg font-bold uppercase tracking-[0.14em] text-foreground">
            Order Summary
          </h2>
          <div className="gift-divider mt-4" />

          <div className="mt-4 divide-y divide-dashed divide-rose-line/30">
            {items.map((item) => {
              return (
                <div
                  key={item.id}
                  data-reveal
                  className="flex items-center gap-4 py-4"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden border border-border bg-blush/30">
                    <div aria-hidden="true" className="wrapping-grid absolute inset-0 opacity-50" />
                    <img
                      src={`/placeholders/${item.category ?? 'flower'}.svg`}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-sm font-medium uppercase tracking-[0.06em] text-foreground">
                      {item.name}
                    </p>
                    <p className="font-sans text-xs text-muted">
                      Qty {item.quantity}
                    </p>
                  </div>
                  <span className="font-sans text-sm font-medium tabular-nums text-foreground">
                    {`$${formatPrice(item.price * item.quantity)}`}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            data-reveal
            className="mt-4 space-y-2 border-t border-dashed border-rose-line/40 pt-4"
          >
            <div className="flex justify-between font-sans text-sm text-foreground">
              <span>
                Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})
              </span>
              <span className="tabular-nums">{`$${formatPrice(subtotal)}`}</span>
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
              <span className="tabular-nums">{`$${formatPrice(total)}`}</span>
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
        className="mt-8 text-center font-sans text-sm text-muted"
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
      <p className="mt-4 font-sans text-sm text-muted">
        Loading your order…
      </p>
    </div>
  );
}

export default function SuccessPageClient() {
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