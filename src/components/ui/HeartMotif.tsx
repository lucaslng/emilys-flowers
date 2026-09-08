import type { CSSProperties } from 'react';

interface HeartMotifProps {
  className?: string;
  size?: number;
  style?: CSSProperties;
}

export default function HeartMotif({ className = '', size = 16, style }: HeartMotifProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
    >
      <path
        d="M12 20 C 8.5 16.5 4.5 13.5 4.5 9.5 C 4.5 6.5 6.5 4.5 9 4.5 C 10.5 4.5 11.5 5.5 12 7 C 12.5 5.5 13.5 4.5 15 4.5 C 17.5 4.5 19.5 6.5 19.5 9.5 C 19.5 13.5 15.5 16.5 12 20 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
