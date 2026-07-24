'use client';

// Next.js 16 App Router `template.tsx`: receives only `children` and remounts
// on segment-level navigation (useEffect re-runs per route). We use this stable
// remount boundary to apply a subtle page-enter animation via a CSS class.
// The reduced-motion guard in globals.css disables the animation when needed.

export default function Template({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="page-enter">{children}</div>;
}