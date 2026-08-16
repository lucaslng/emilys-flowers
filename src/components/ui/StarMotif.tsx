// StarMotif — the "origami star base" motif from the product photography:
// a crisp 8-point folded star, the geometric counterpoint to the satin
// petals. Purely decorative (aria-hidden). Optional slow spin via the
// `animate-star` utility (collapsed by the reduced-motion guard).
//
// Fills use `currentColor`, so the parent controls the tone via a text
// color utility (e.g. `text-rose`).

interface StarMotifProps {
  className?: string;
  size?: number;
}

export default function StarMotif({ className = '', size = 96 }: StarMotifProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* 8-point star built from two rotated squares + folded facets */}
      <g fill="currentColor">
        <rect x="38" y="38" width="24" height="24" opacity="0.55" />
        <rect x="38" y="38" width="24" height="24" opacity="0.55" transform="rotate(45 50 50)" />
        <rect x="46.5" y="46.5" width="7" height="7" fill="#FEFAF5" opacity="0.9" />
        <path d="M50 26 L54 46 L50 50 L46 46 Z" opacity="0.8" />
        <path d="M50 74 L54 54 L50 50 L46 54 Z" opacity="0.8" />
        <path d="M26 50 L46 54 L50 50 L46 46 Z" opacity="0.8" />
        <path d="M74 50 L54 46 L50 50 L54 54 Z" opacity="0.8" />
      </g>
    </svg>
  );
}