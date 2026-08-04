'use client';

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';
import { prefersReducedMotion } from '@/lib/reduced-motion';

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Reveal children one-by-one with a stagger instead of the wrapper as a single unit. */
  stagger?: boolean;
  delay?: number;
  y?: number;
  duration?: number;
  /** Animate only the first time it enters the viewport. */
  once?: boolean;
}

export default function Reveal({
  children,
  as,
  className = '',
  stagger = false,
  delay = 0,
  y = 16,
  duration = 0.7,
  once = true,
}: RevealProps) {
  const container = useRef<HTMLDivElement>(null);
  // Once a `once` reveal has fired, a prop change must not re-hide it.
  const fired = useRef(false);
  const Tag = (as || 'div') as ElementType;

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    // Already revealed and never re-triggering: don't re-hide on a prop change.
    if (fired.current && once) return;

    const targets = stagger ? (Array.from(el.children) as HTMLElement[]) : [el];

    if (prefersReducedMotion()) {
      // Show everything immediately, no animation. The global CSS guard also
      // forces `.reveal-init` visible; these inline styles cover the stagger
      // children, which carry no CSS class of their own.
      el.style.opacity = '1';
      el.style.transform = 'none';
      for (const target of targets) {
        target.style.opacity = '1';
        target.style.transform = 'none';
      }
      return;
    }

    if (stagger) {
      // The `reveal-init` class hides the WRAPPER (opacity: 0) to prevent
      // FOUC. But we animate the CHILDREN, not the wrapper — so hide the
      // children inline first, then un-hide the wrapper (same ordering as
      // the GSAP version: wrapper visible instantly, children draw in on
      // scroll).
      for (const child of targets) {
        child.style.opacity = '0';
        child.style.transform = `translateY(${y}px)`;
      }
      el.style.opacity = '1';
      el.style.transform = 'none';
    }

    // power2.out ≈ cubic-bezier(0.25, 0.46, 0.45, 0.94) — the easing the
    // GSAP version used, kept so the reveal feels identical.
    const EASE = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';

    const play = () => {
      if (fired.current && once) return;
      fired.current = true;
      targets.forEach((target, i) => {
        target.animate(
          [
            { opacity: 0, transform: `translateY(${y}px)` },
            { opacity: 1, transform: 'translateY(0px)' },
          ],
          {
            duration: duration * 1000,
            // GSAP's `stagger: 0.12`: child i starts at delay + i * 0.12s.
            delay: delay * 1000 + i * 120,
            easing: EASE,
            fill: 'both',
          }
        );
      });
    };

    // ScrollTrigger's `start: 'top 85%'` fires when the element's top crosses
    // the line 85% down the viewport. Shrinking the root's bottom edge by 15%
    // moves that line to the bottom of the intersection rect — the element's
    // top crossing it counts as an intersection, a pixel-for-pixel equivalent
    // trigger. (A top margin would shrink the visible band too, changing when
    // above-the-fold content fires; the old trigger had no such band.)
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          play();
          if (once) observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -15% 0px' }
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, [stagger, delay, y, duration, once]);

  return (
    <Tag ref={container} className={`reveal-init ${className}`.trim()}>
      {children}
    </Tag>
  );
}
