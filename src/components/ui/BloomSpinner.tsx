interface BloomSpinnerProps {
  size?: number;
  className?: string;
  color?: string;
}

/**
 * A small flower SVG whose petals bloom open + gently rotate, looping, for
 * loading states. Elegant, not childish. Respects prefers-reduced-motion
 * (static bloom at full scale, no rotation) — the motion classes are declared
 * only under `(prefers-reduced-motion: no-preference)` in globals.css, so
 * reduced-motion users get the static flower with no animation to cancel.
 *
 * Pure presentational markup (no client hooks, no GSAP): it renders as a
 * server component and ships zero JS of its own.
 */
export default function BloomSpinner({
  size = 48,
  className = '',
  color = '#D4A5A5',
}: BloomSpinnerProps) {
  // 6 petals arranged radially around center (24, 24).
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
      {/* Two nested groups, one per transform: the outer blooms open once
          (scale 0→1), the inner spins forever. GSAP composed both on one
          element, but CSS can't run a one-shot and an infinite loop on the
          same transform — the groups split the work. The center circle
          stays outside both: it never bloomed or spun before, and still
          doesn't. */}
      <g className="bloom-spinner-grow">
        <g className="bloom-spinner-rotate">{petals}</g>
      </g>
      {/* Flower center */}
      <circle cx="24" cy="24" r="5" fill="#F9E4E4" />
    </svg>
  );
}
