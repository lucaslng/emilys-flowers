interface SquiggleUnderlineProps {
  className?: string;
  color?: string;
  width?: number | string;
  strokeWidth?: number;
}

/**
 * A hand-drawn squiggle that sits under section headings and "draws in" via
 * stroke-dashoffset. Slightly imperfect, organic hand-drawn feel. Respects
 * prefers-reduced-motion (renders fully drawn, no animation) — the dash
 * styles are applied only under `(prefers-reduced-motion: no-preference)`.
 *
 * Pure presentational markup (no client hooks, no GSAP): it renders as a
 * server component and ships zero JS of its own.
 */
export default function SquiggleUnderline({
  className = '',
  color = '#D4A5A5',
  width = 120,
  strokeWidth = 3,
}: SquiggleUnderlineProps) {
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
      {/* `pathLength={1}` normalizes the path length to 1, so the dash
          values in `.squiggle-draw` are literal fractions of the whole —
          no getTotalLength() needed to size the dash. */}
      <path
        className="squiggle-draw"
        d="M4 8 Q 14 2 24 8 T 44 8 T 64 8 T 84 8 T 104 8 T 116 8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        pathLength={1}
        fill="none"
      />
    </svg>
  );
}
