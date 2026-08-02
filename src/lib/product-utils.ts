// product-utils.ts
//
// Client-safe pure helpers for product listing/filtering. No Stripe, no server
// imports — safe to use from Client Components.

import type { Product } from '@/types';

/**
 * Min–max price in cents across the given products, as `[min, max]`.
 * Returns `[0, 0]` for an empty list so callers never feed `Infinity`
 * into `min`/`max` attributes.
 */
export function getPriceRange(products: Product[]): [number, number] {
  if (products.length === 0) return [0, 0];
  const prices = products.map((p) => p.price);
  return [Math.min(...prices), Math.max(...prices)];
}

/** Humanize a snake_case value, e.g. "cream_white" → "Cream White". */
export function formatLabel(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export interface FilterOption {
  label: string;
  value: string;
}

/** Unique flower types (metadata `flower_type`) as filter options, "All" first. */
export function getFlowerTypes(products: Product[]): FilterOption[] {
  const types = [
    ...new Set(products.map((p) => p.flowerType).filter(Boolean) as string[]),
  ];
  return [
    { label: 'All', value: 'all' },
    ...types.map((t) => ({ label: formatLabel(t), value: t })),
  ];
}

/** Unique flower colors (metadata `color`) as filter options, "All" first. */
export function getFlowerColors(products: Product[]): FilterOption[] {
  const colors = [
    ...new Set(products.map((p) => p.color).filter(Boolean) as string[]),
  ];
  return [
    { label: 'All', value: 'all' },
    ...colors.map((c) => ({ label: formatLabel(c), value: c })),
  ];
}