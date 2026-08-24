// Decorative 8-point "origami star" motif; fills use `currentColor` so the
// parent controls the tone via a text color utility.

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