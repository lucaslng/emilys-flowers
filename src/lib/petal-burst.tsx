'use client';

// PetalBurst singleton: PetalBurstProvider registers its handle once near the root; callers firePetalBurst with viewport coordinates (fixed-position layer).

import { useEffect, useRef } from 'react';
import { PetalBurstLayer, type PetalBurstHandle } from '@/components/ui/PetalBurst';

let handle: PetalBurstHandle | null = null;

/** Burst from `from` to `to` (viewport coordinates); no-op without a mounted layer or under prefers-reduced-motion. */
export function firePetalBurst(
  from: { x: number; y: number },
  to: { x: number; y: number }
): void {
  handle?.burst(from, to);
}

/** Burst from the center of `fromEl` toward #cart-icon; no-op when the icon isn't mounted (reduced motion handled by firePetalBurst). */
export function addWithPetalBurst(fromEl: Element): void {
  const from = fromEl.getBoundingClientRect();
  const cart = document.getElementById('cart-icon')?.getBoundingClientRect();
  if (!cart) return;
  firePetalBurst(
    { x: from.left + from.width / 2, y: from.top + from.height / 2 },
    { x: cart.left + cart.width / 2, y: cart.top + cart.height / 2 }
  );
}

export function PetalBurstProvider() {
  const ref = useRef<PetalBurstHandle>(null);

  useEffect(() => {
    handle = ref.current;
    return () => {
      handle = null;
    };
  }, []);

  return <PetalBurstLayer ref={ref} />;
}