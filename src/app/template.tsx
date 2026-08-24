'use client';

// template.tsx remounts on segment navigation — used as a stable boundary for
// the per-route page-enter animation (reduced-motion-guarded in globals.css).

import type { ReactNode } from 'react';

export default function Template({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="page-enter">{children}</div>;
}