/**
 * ArrowFlourish — the hand-drawn annotation arrow used beside handwritten
 * labels. Three sizes with distinct hand-drawn paths (not a scaled single
 * drawing); `flip` mirrors it for right-aligned compositions. Decorative
 * (aria-hidden) and boils via `.line-boil`.
 */
const VARIANTS = {
  sm: {
    width: 64,
    height: 20,
    viewBox: '0 0 64 20',
    strokeWidth: '1.4',
    shaft: 'M2 16 C 20 12 38 6 60 3',
    head: 'M60 3 L 51 2 M 60 3 L 56 11',
  },
  md: {
    width: 72,
    height: 24,
    viewBox: '0 0 72 24',
    strokeWidth: '1.4',
    shaft: 'M4 20 C 24 16 46 8 68 5',
    head: 'M68 5 L 59 4 M 68 5 L 64 13',
  },
  lg: {
    width: 90,
    height: 34,
    viewBox: '0 0 90 34',
    strokeWidth: '1.6',
    shaft: 'M4 26 C 30 22 52 14 84 8',
    head: 'M84 8 L 74 6 M 84 8 L 80 17',
  },
} as const;

interface ArrowFlourishProps {
  size?: keyof typeof VARIANTS;
  /** Mirror horizontally for right-aligned layouts. */
  flip?: boolean;
  className?: string;
}

export default function ArrowFlourish({
  size = 'sm',
  flip = false,
  className = 'line-boil text-rose-line',
}: ArrowFlourishProps) {
  const variant = VARIANTS[size];
  return (
    <svg
      aria-hidden="true"
      width={variant.width}
      height={variant.height}
      viewBox={variant.viewBox}
      fill="none"
      className={`${className}${flip ? ' -scale-x-100' : ''}`}
    >
      <path
        d={variant.shaft}
        stroke="currentColor"
        strokeWidth={variant.strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={variant.head}
        stroke="currentColor"
        strokeWidth={variant.strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
