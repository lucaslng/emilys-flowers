'use client';

/**
 * PetalBurst — a "petal burst" delight effect for the add-to-cart moment.
 *
 * Small petal SVGs fly from an origin point (e.g. the "Add to Cart" button) to a
 * target point (e.g. the cart icon in the navbar), spinning and fading as they travel.
 *
 * ── API ──────────────────────────────────────────────────────────────────────
 *   <PetalBurstLayer ref={layerRef} />   // place ONCE, near the root of a client tree
 *
 *   const layerRef = useRef<PetalBurstHandle>(null);
 *   layerRef.current?.burst(
 *     { x, y },   // viewport coords of the origin (e.g. button.getBoundingClientRect() center)
 *     { x, y },   // viewport coords of the target (e.g. cart icon center)
 *   );
 *
 * Exported:
 *   - PetalBurstLayer  : the overlay component (fixed, inset-0, pointer-events-none, high z)
 *   - PetalBurstHandle : ref handle type with `burst(from, to): void`
 *
 * Coordinates are viewport-relative because the layer is `position: fixed`.
 * Respects prefers-reduced-motion: when reduced, `burst()` is a no-op.
 *
 * GSAP is NOT statically imported here — a static import would pull the ~44 KB
 * gsap chunk into every route's initial JS payload. Instead it is loaded
 * lazily on the first burst (cached module-level), so the chunk loads at most
 * once, only when a burst actually fires.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { prefersReducedMotion } from '@/lib/reduced-motion';

/**
 * Lazily loads the gsap module on first use, cached so the dynamic import runs
 * at most once per session. Keeps gsap off the initial JS payload of every
 * route until the first burst actually fires.
 */
let gsapPromise: Promise<typeof import('@/lib/gsap')> | null = null;
function loadGsap(): Promise<typeof import('@/lib/gsap')> {
  gsapPromise ??= import('@/lib/gsap');
  return gsapPromise;
}

export interface PetalBurstHandle {
  /** Fire a burst of petals from `from` to `to` (viewport coordinates). */
  burst(from: { x: number; y: number }, to: { x: number; y: number }): void;
}

export interface PetalBurstLayerProps {
  /** Optional className merged onto the fixed overlay (e.g. to tune z-index). */
  className?: string;
}

/** Brand petal colors — randomized per petal. */
const PETAL_COLORS = ['#F9E4E4', '#D4A5A5', '#E8D5E8'] as const;

/** A single petal SVG (teardrop/leaf shape) wrapped in a positioning element. */
function createPetal(color: string): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.style.position = 'absolute';
  wrapper.style.left = '0';
  wrapper.style.top = '0';
  wrapper.style.width = '18px';
  wrapper.style.height = '18px';
  wrapper.style.pointerEvents = 'none';
  wrapper.style.willChange = 'transform, opacity';
  wrapper.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    `<path d="M12 2 C 7 7, 7 15, 12 20 C 17 15, 17 7, 12 2 Z" fill="${color}"/>` +
    '</svg>';
  return wrapper;
}

export const PetalBurstLayer = forwardRef<PetalBurstHandle, PetalBurstLayerProps>(
  function PetalBurstLayer({ className }, ref) {
    const layerRef = useRef<HTMLDivElement>(null);
    // Track in-flight timelines so we can kill + clean them up on unmount.
    // Structurally typed ({ kill(): void }) so no runtime gsap import is needed.
    const timelinesRef = useRef<Set<{ kill(): void }>>(new Set());

    useImperativeHandle(ref, () => ({
      burst(from, to) {
        // Respect reduced-motion: do nothing.
        if (prefersReducedMotion()) return;

        // Load gsap lazily on first burst (cached module-level), then run the
        // entire burst inside the callback. Re-check the layer after the
        // import resolves: the component may have unmounted while the chunk
        // was in flight.
        void loadGsap().then(({ gsap }) => {
          const layer = layerRef.current;
          if (!layer) return;

          // 6–10 petals, each with a randomized brand color.
          const count = 6 + Math.floor(Math.random() * 5);
          const petals: HTMLDivElement[] = [];
          for (let i = 0; i < count; i++) {
            const color =
              PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)];
            const petal = createPetal(color);
            layer.appendChild(petal);
            petals.push(petal);
          }

          const tl = gsap.timeline({
            onComplete: () => {
              petals.forEach((p) => p.remove());
              timelinesRef.current.delete(tl);
            },
          });
          timelinesRef.current.add(tl);

          petals.forEach((petal, i) => {
            // Small randomized spread so the burst feels organic, not mechanical.
            const startX = from.x + (Math.random() - 0.5) * 10;
            const startY = from.y + (Math.random() - 0.5) * 10;
            const endX = to.x + (Math.random() - 0.5) * 18;
            const endY = to.y + (Math.random() - 0.5) * 18;

            const startRot = Math.random() * 360;
            const spin = 180 + Math.random() * 360; // 180–540deg
            const endRot = startRot + spin * (Math.random() < 0.5 ? -1 : 1);
            const duration = 0.7 + Math.random() * 0.3; // 0.7–1.0s
            const offset = i * 0.04; // ~0.04s stagger between petals

            // Start small + transparent at the origin.
            gsap.set(petal, {
              x: startX,
              y: startY,
              scale: 0.4,
              rotation: startRot,
              opacity: 0,
            });

            // Travel + spin (GPU-friendly: transform only).
            tl.to(
              petal,
              {
                x: endX,
                y: endY,
                rotation: endRot,
                duration,
                ease: 'power1.inOut',
              },
              offset,
            );

            // Opacity: fade in quickly, fade out near the end.
            tl.to(petal, { opacity: 1, duration: 0.15, ease: 'power1.out' }, offset)
              .to(
                petal,
                { opacity: 0, duration: 0.28, ease: 'power1.in' },
                offset + duration - 0.28,
              );

            // Scale: bloom up, then ease down as it "lands".
            tl.to(petal, { scale: 1, duration: duration * 0.45, ease: 'power1.out' }, offset)
              .to(
                petal,
                { scale: 0.7, duration: duration * 0.55, ease: 'power1.in' },
                offset + duration * 0.45,
              );
          });
        });
      },
    }));

    // Kill any in-flight tweens and drop leftover petal nodes on unmount.
    useEffect(() => {
      const timelines = timelinesRef.current;
      return () => {
        timelines.forEach((t) => t.kill());
        timelines.clear();
        if (layerRef.current) layerRef.current.replaceChildren();
      };
    }, []);

    return (
      <div
        ref={layerRef}
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-[9999] overflow-hidden${
          className ? ` ${className}` : ''
        }`}
      />
    );
  },
);