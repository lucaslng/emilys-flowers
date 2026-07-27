'use client';

import { useRef, type ReactNode, type ElementType } from 'react';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';
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
  const Tag = (as || 'div') as ElementType;

  useGSAP(
    () => {
      const targets = stagger
        ? gsap.utils.toArray<HTMLElement>(container.current?.children ?? [])
        : container.current;
      if (!targets) return;

      if (prefersReducedMotion()) {
        // Reduced motion: show immediately, no animation.
        gsap.set(container.current, { opacity: 1, y: 0, clearProps: 'transform,opacity' });
        if (stagger) gsap.set(targets, { opacity: 1, y: 0, clearProps: 'transform,opacity' });
        return;
      }

      if (stagger) {
        // The `reveal-init` class hides the WRAPPER (opacity:0) to prevent
        // FOUC. But we animate the CHILDREN, not the wrapper — so we must
        // un-hide the wrapper first, then animate children in.
        gsap.set(container.current, { opacity: 1, y: 0 });
        gsap.fromTo(
          targets,
          { opacity: 0, y },
          {
            opacity: 1,
            y: 0,
            duration,
            delay,
            ease: 'power2.out',
            stagger: 0.12,
            scrollTrigger: {
              trigger: container.current,
              start: 'top 85%',
              once,
            },
          }
        );
      } else {
        // fromTo (not `from`): the `reveal-init` class already sets opacity:0 /
        // translateY, so `from()` would snapshot 0 as the END state and stay
        // invisible. Explicit end state guarantees the reveal.
        gsap.fromTo(
          targets,
          { opacity: 0, y },
          {
            opacity: 1,
            y: 0,
            duration,
            delay,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: container.current,
              start: 'top 85%',
              once,
            },
          }
        );
      }
    },
    { scope: container, dependencies: [] }
  );

  return (
    <Tag ref={container} className={`reveal-init ${className}`.trim()}>
      {children}
    </Tag>
  );
}