'use client';

import { useRef, type RefObject } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';
import { prefersReducedMotion } from '@/lib/reduced-motion';

/** Scale pulse on `targets` whenever `dependency` changes; skips the initial mount and no-ops under prefers-reduced-motion. */
export function useScaleBump(
  dependency: unknown,
  targets: ReadonlyArray<RefObject<HTMLElement | null>>,
  scope: RefObject<HTMLElement | null>
): void {
  const isFirstRun = useRef(true);

  useGSAP(
    () => {
      if (isFirstRun.current) {
        isFirstRun.current = false;
        return;
      }
      if (prefersReducedMotion()) return;
      const nodes = targets
        .map((ref) => ref.current)
        .filter((n): n is HTMLElement => n !== null);
      if (nodes.length === 0) return;
      gsap.fromTo(
        nodes,
        { scale: 1 },
        {
          scale: 1.12,
          duration: 0.12,
          ease: 'power2.out',
          yoyo: true,
          repeat: 1,
          stagger: 0.04,
        }
      );
    },
    { dependencies: [dependency], scope }
  );
}
