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

/**
 * Exit-collapse tween shared by cart removals: fade + slide right + collapse
 * height/margins/padding, then invoke `onRemove` in onComplete so React state
 * and the visual exit stay in sync. Keep it short (≤400ms) so Playwright
 * doesn't flake. Extra vars (e.g. `stagger`) merge over
 * the defaults. Callers keep the returned tween so it can be killed on
 * unmount and a stale `onRemove` can't fire after navigation.
 */
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