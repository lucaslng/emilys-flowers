/**
 * Returns true when the user has requested reduced motion via the OS / browser.
 *
 * Safe to call during SSR and in non-browser runtimes: returns `false` there
 * (no `window` / `matchMedia`), so animation code falls back to its default
 * path instead of no-oping. In the browser, reflects the live
 * `(prefers-reduced-motion: reduce)` media query.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
