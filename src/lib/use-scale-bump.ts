'use client';

import { useRef, type RefObject } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';
import { prefersReducedMotion } from '@/lib/reduced-motion';

/**
 * Scale-bump micro-interaction: a subtle scale pulse on the element(s)
 * referenced by `targets` whenever `dependency` changes. Skips the initial
 * mount so the bump only plays on real changes, and no-ops under reduced
 * motion. `scope` limits the tween's context to the component root.
 */
export function useScaleBump(
  dependency: unknown,
  targets: ReadonlyArray<RefObject<HTMLElement | null>>,
  scope: RefObject<HTMLElement | null>
): void {
  // Skips the bump on the initial mount (only react to real changes).
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
