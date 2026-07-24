'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

interface SquiggleUnderlineProps {
  className?: string;
  color?: string;
  width?: number | string;
  strokeWidth?: number;
}

/**
 * A hand-drawn squiggle that sits under section headings and "draws in" on mount
 * via stroke-dashoffset. Slightly imperfect, organic hand-drawn feel.
 * Respects prefers-reduced-motion (renders fully drawn, no animation).
 */
export default function SquiggleUnderline({
  className = '',
  color = '#D4A5A5',
  width = 120,
  strokeWidth = 3,
}: SquiggleUnderlineProps) {
  const pathRef = useRef<SVGPathElement>(null);

  useGSAP(
    () => {
      const path = pathRef.current;
      if (!path) return;
      const length = path.getTotalLength();

      gsap.matchMedia({
        '(prefers-reduced-motion: no-preference)': () => {
          gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
          gsap.to(path, {
            strokeDashoffset: 0,
            duration: 1,
            ease: 'power2.out',
          });
        },
        '(prefers-reduced-motion: reduce)': () => {
          gsap.set(path, { strokeDasharray: 'none', strokeDashoffset: 0 });
        },
      });
    },
    { dependencies: [] }
  );

  return (
    <svg
      width={width}
      height="16"
      viewBox="0 0 120 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        ref={pathRef}
        d="M4 8 Q 14 2 24 8 T 44 8 T 64 8 T 84 8 T 104 8 T 116 8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}