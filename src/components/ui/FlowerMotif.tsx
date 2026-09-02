// Decorative 5-petal blossom motif; strokes use `currentColor` so the parent
// controls the tone via a text color utility. Static — no animation.

import type { CSSProperties } from 'react';

interface FlowerMotifProps {
  className?: string;
  size?: number;
  style?: CSSProperties;
}

const PETAL_RADIUS = 8.5;
const PETAL_DISTANCE = 11.9;

export default function FlowerMotif({
  className = '',
  size = 32,
  style,
}: FlowerMotifProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <circle
          key={i}
          cx="24"
          cy={24 - PETAL_DISTANCE}
          r={PETAL_RADIUS}
          stroke="currentColor"
          strokeWidth={3}
          transform={`rotate(${i * 72} 24 24)`}
        />
      ))}
      <circle cx="24" cy="24" r="4.25" stroke="currentColor" strokeWidth={3} />
    </svg>
  );
}