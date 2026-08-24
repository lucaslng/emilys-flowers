/** True for (prefers-reduced-motion: reduce); false during SSR/non-browser runtimes so animation code takes its default path. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
