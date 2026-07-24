'use client';

/**
 * PetalBurst singleton — lets any client component fire a petal burst without
 * prop-drilling the layer ref. `PetalBurstProvider` is mounted once (in the root
 * layout); it registers its handle here. Callers import `firePetalBurst`.
 *
 * Coordinates are viewport-relative (the layer is position: fixed).
 */

import { useEffect, useRef } from 'react';
import { PetalBurstLayer, type PetalBurstHandle } from '@/components/ui/PetalBurst';

let handle: PetalBurstHandle | null = null;

/** Fire a petal burst from `from` to `to` (viewport coordinates). No-op if no
 *  layer is mounted or if the user prefers reduced motion. */
export function firePetalBurst(
  from: { x: number; y: number },
  to: { x: number; y: number }
): void {
  handle?.burst(from, to);
}

/** Mount once near the root of the client tree (e.g. in the root layout). */
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