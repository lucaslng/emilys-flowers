'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

interface BloomSpinnerProps {
  size?: number;
  className?: string;
  color?: string;
}

/** Flower SVG that blooms open + slowly rotates; static under reduced motion. */
export default function BloomSpinner({
  size = 48,
  className = '',
  color = '#D4A5A5',
}: BloomSpinnerProps) {
  const petalGroup = useRef<SVGGElement>(null);

  useGSAP(
    () => {
      const group = petalGroup.current;
      if (!group) return;

      gsap.matchMedia({
        '(prefers-reduced-motion: no-preference)': () => {
          gsap.from(group, {
            scale: 0,
            duration: 0.6,
            ease: 'power2.out',
            transformOrigin: '24px 24px',
          });
          gsap.to(group, {
            rotation: 360,
            duration: 8,
            ease: 'none',
            repeat: -1,
            transformOrigin: '24px 24px',
          });
        },
        '(prefers-reduced-motion: reduce)': () => {
          gsap.set(group, { scale: 1, rotation: 0, transformOrigin: '24px 24px' });
        },
      });
    },
    { dependencies: [] }
  );

  const petals = Array.from({ length: 6 }, (_, i) => {
    const rotation = (i * 360) / 6;
    return (
      <path
        key={i}
        d="M24 24 C 21 18 21 10 24 4 C 27 10 27 18 24 24"
        fill={color}
        opacity={0.85}
        transform={`rotate(${rotation} 24 24)`}
      />
    );
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <g ref={petalGroup}>{petals}</g>
      <circle cx="24" cy="24" r="5" fill="#F9E4E4" />
    </svg>
  );
}