'use client';

import { useRef } from 'react';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';

interface StemGrowthProps {
  className?: string;
  color?: string;
}

/**
 * A decorative botanical stem with leaves that "grows" as the user scrolls
 * (ScrollTrigger scrubs stroke-dashoffset along the stem + leaves). Elegant,
 * decorative. Respects prefers-reduced-motion (renders fully grown, no scrub).
 */
export default function StemGrowth({
  className = '',
  color = '#B5A77A',
}: StemGrowthProps) {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const paths = gsap.utils.toArray<SVGPathElement>(
        container.current?.querySelectorAll('path') ?? []
      );
      if (paths.length === 0) return;

      gsap.matchMedia({
        '(prefers-reduced-motion: no-preference)': () => {
          paths.forEach((path, i) => {
            const length = path.getTotalLength();
            gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
            gsap.to(path, {
              strokeDashoffset: 0,
              ease: 'none',
              scrollTrigger: {
                trigger: container.current,
                start: 'top 80%',
                end: 'bottom 20%',
                scrub: true,
              },
              // Leaves grow slightly after the stem (index 0 = stem).
              delay: i === 0 ? 0 : 0.2,
            });
          });
        },
        '(prefers-reduced-motion: reduce)': () => {
          paths.forEach((path) => {
            gsap.set(path, { strokeDasharray: 'none', strokeDashoffset: 0 });
          });
        },
      });
    },
    { scope: container, dependencies: [] }
  );

  return (
    <div ref={container} className={className} aria-hidden="true">
      <svg
        width="60"
        height="240"
        viewBox="0 0 60 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Stem */}
        <path
          d="M30 238 Q 26 160 30 80 Q 33 40 30 4"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Left leaf */}
        <path
          d="M30 180 Q 10 170 6 150 Q 22 158 30 180"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          fill={color}
          fillOpacity="0.25"
        />
        {/* Right leaf */}
        <path
          d="M30 120 Q 52 110 56 90 Q 38 98 30 120"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          fill={color}
          fillOpacity="0.25"
        />
      </svg>
    </div>
  );
}