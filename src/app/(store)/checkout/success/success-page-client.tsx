'use client';

// /checkout/success
//
// Shown after a completed Stripe Checkout. The success URL carries no product
// data — only ?success=true&order=<EF-XXXXXX>&session_id={CHECKOUT_SESSION_ID}
// — and the receipt is fetched from GET /api/checkout/session. Until it
// resolves (or fails), only the generic confirmation shows.
//
// We show a warm confirmation + an order summary that mirrors `/checkout`,
// clear the cart (the order is already placed), and celebrate with a small
// petal burst released from the thank-you heading.
//
// `useSearchParams()` is wrapped in <Suspense> per Next.js 16's static-render
// requirement (the fallback is a branded BloomSpinner placeholder).

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { gsap, useGSAP } from '@/lib/gsap';
import { firePetalBurst } from '@/lib/petal-burst';
import { computeLineItemTotal, computeLineItemCount, computeShipping, type LineItem } from '@/lib/order';
import { formatPrice } from '@/lib/format';
import { useCart } from '@/lib/cart-context';
import Container from '@/components/ui/Container';
import Button from '@/components/ui/Button';
import BloomSpinner from '@/components/ui/BloomSpinner';

/** The sanitized projection returned by GET /api/checkout/session. */
interface RetrievedOrder {
  items: Array<{
    name: string;
    image: string;
    quantity: number;
    unitAmount: number;
  }>;
  subtotal: number;
  shipping: number;
  total: number;
  orderNumber: string;
}

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const { clearCart } = useCart();
  const root = useRef<HTMLDivElement>(null);
  const burstAnchorRef = useRef<HTMLDivElement>(null);

  const orderParam = searchParams.get('order') ?? '';
  const sessionId = searchParams.get('session_id');

  // Receipt retrieval; failures degrade to the generic confirmation.
  const [retrieved, setRetrieved] = useState<RetrievedOrder | null>(null);
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    fetch(`/api/checkout/session?session_id=${encodeURIComponent(sessionId)}`)
      .then(async (response) =>
        response.ok ? ((await response.json()) as RetrievedOrder) : null
      )
      .then((data) => {
        if (!cancelled && data) setRetrieved(data);
      })
      .catch(() => {
        // Leave the generic confirmation in place.
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const items: Array<LineItem & { image: string }> = (
    retrieved?.items ?? []
  ).map((item, index) => ({
    id: `${index}`,
    name: item.name,
    image: item.image,
    price: item.unitAmount,
    quantity: item.quantity,
  }));
  const hasItems = items.length > 0;

  const order = orderParam || retrieved?.orderNumber || '';

  // The order is already placed — clear the cart once on mount.
  useEffect(() => {
    clearCart();
  }, [clearCart]);

  // Orchestrated mount reveal: one staggered timeline across every
  // [data-reveal] section (heading → subtitle → pill → summary →
  // line items → totals → CTAs → reassurance), plus a three-wave petal
  // burst released downward from the thank-you heading. Reduced motion
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

        // Petal celebration: releases three staggered waves of petals that
        // drift down over the receipt. Viewport coords (the petal layer is
        // position: fixed).
        const anchor = burstAnchorRef.current;
        if (anchor) {
          const r = anchor.getBoundingClientRect();
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

  // Amounts come from the retrieved receipt; the compute* fallbacks only
  // cover defensively-missing fields (issue #177).
  const subtotal = retrieved?.subtotal ?? computeLineItemTotal(items);
  const shipping = retrieved?.shipping ?? computeShipping(subtotal);
  const total = retrieved?.total ?? subtotal + shipping;
  const itemCount = computeLineItemCount(items);

  return (
    <div ref={root} className="mx-auto max-w-2xl">
      {/* ── Hero — the thank-you card ─────────────────────────────── */}
      <div className="relative text-center">
        <div ref={burstAnchorRef} data-reveal className="mt-6">
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
                      src={item.image}
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