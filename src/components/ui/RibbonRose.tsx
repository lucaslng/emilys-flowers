// RibbonRose — a decorative hand-folded ribbon rose, the "satin softness"
// half of the brand. Layered dimensional petals + a crisp ribbon knot.
// Purely decorative (aria-hidden). Used in the home hero, empty states,
// and the under-construction screen.

interface RibbonRoseProps {
  className?: string;
  size?: number;
}

export default function RibbonRose({ className = '', size = 220 }: RibbonRoseProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer petals — satin blush with dimensional shading */}
      <g opacity="0.9">
        <path
          d="M100 42 C 58 42 40 78 44 108 C 30 96 26 72 40 54 C 52 40 74 36 100 42 Z"
          fill="#F9E4E4"
          stroke="#D4A5A5"
          strokeWidth="1.2"
        />
        <path
          d="M100 42 C 142 42 160 78 156 108 C 170 96 174 72 160 54 C 148 40 126 36 100 42 Z"
          fill="#F9E4E4"
          stroke="#D4A5A5"
          strokeWidth="1.2"
        />
        <path
          d="M100 42 C 66 30 40 44 34 70 C 44 60 70 52 100 58 C 130 52 156 60 166 70 C 160 44 134 30 100 42 Z"
          fill="#F6DCD8"
          stroke="#D4A5A5"
          strokeWidth="1.2"
        />
      </g>

      {/* Mid petals — champagne undertone, folded over */}
      <path
        d="M100 62 C 76 62 62 84 66 104 C 74 94 86 88 100 88 C 114 88 126 94 134 104 C 138 84 124 62 100 62 Z"
        fill="#F3E4D3"
        stroke="#D4A5A5"
        strokeWidth="1.1"
      />
      <path
        d="M100 66 C 82 60 66 70 62 86 C 76 78 88 74 100 74 C 112 74 124 78 138 86 C 134 70 118 60 100 66 Z"
        fill="#F9E4E4"
        stroke="#D4A5A5"
        strokeWidth="1.1"
      />

      {/* Inner spiral — the folded heart of the rose */}
      <path
        d="M100 78 C 88 78 82 88 84 96 C 88 92 94 90 100 90 C 106 90 112 92 116 96 C 118 88 112 78 100 78 Z"
        fill="#F6DCD8"
        stroke="#D4A5A5"
        strokeWidth="1"
      />
      <path
        d="M100 88 C 94 88 91 93 92 98 C 95 95 97 94 100 94 C 103 94 105 95 108 98 C 109 93 106 88 100 88 Z"
        fill="#D4A5A5"
      />
      <circle cx="100" cy="95" r="3" fill="#B16E6E" opacity="0.7" />

      {/* Ribbon knot + tails — the crisp geometric counterpoint */}
      <rect x="92" y="104" width="16" height="12" rx="2" fill="#D4A5A5" />
      <path d="M94 116 C 88 128 80 138 74 146" stroke="#D4A5A5" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M106 116 C 112 128 120 138 126 146" stroke="#D4A5A5" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M96 116 C 90 126 84 132 80 138" stroke="#B16E6E" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.6" />
      <path d="M104 116 C 110 126 116 132 120 138" stroke="#B16E6E" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.6" />
    </svg>
  );
}