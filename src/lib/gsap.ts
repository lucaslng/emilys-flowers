'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
  // ScrollTrigger writes to body.style on enable(); clearing it avoids a Next.js hydration warning.
  document.body.removeAttribute('style');
}

export { gsap, ScrollTrigger, useGSAP };

/** Exit tween for cart removals: fade + slide + collapse; onRemove fires in onComplete so React state tracks the visual exit. Keep ≤400ms (Playwright flake); callers keep the returned tween to kill it on unmount. */
export function collapseAndRemove(
  element: gsap.TweenTarget,
  onRemove: () => void,
  vars?: gsap.TweenVars
): gsap.core.Tween {
  return gsap.to(element, {
    opacity: 0,
    x: 40,
    height: 0,
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    duration: 0.35,
    ease: 'power2.in',
    ...vars,
    onComplete: onRemove,
  });
}
