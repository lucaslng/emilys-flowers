'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import Button from '@/components/ui/Button';

/**
 * EmptyCartCard — the open-gift-box empty state shared by the cart and
 * checkout pages. Motif, copy, heading level, and spacing come from the
 * caller so each page keeps its exact current look.
 */
interface EmptyCartCardProps {
  /** Extra classes on the stitch card (min-height, vertical padding). */
  className?: string;
  /** Decorative motif(s) above the heading. */
  motif: ReactNode;
  headingLevel?: 'h1' | 'h2';
  title?: string;
  titleClassName: string;
  message: ReactNode;
  messageClassName: string;
  ctaHref: string;
  ctaLabel: string;
  ctaClassName: string;
}

export default function EmptyCartCard({
  className = '',
  motif,
  headingLevel: HeadingLevel = 'h2',
  title = 'Your cart is empty',
  titleClassName,
  message,
  messageClassName,
  ctaHref,
  ctaLabel,
  ctaClassName,
}: EmptyCartCardProps) {
  return (
    <div
      className={`stitch relative flex flex-col items-center justify-center bg-surface px-6 text-center ${className}`}
    >
      {motif}
      <HeadingLevel className={titleClassName}>{title}</HeadingLevel>
      <p className={messageClassName}>{message}</p>
      <Link href={ctaHref} className={ctaClassName}>
        <Button variant="primary">{ctaLabel}</Button>
      </Link>
    </div>
  );
}
