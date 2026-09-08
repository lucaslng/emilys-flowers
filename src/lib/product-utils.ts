// Client-safe pure helpers — no Stripe, no server imports.

import type { Product } from '@/types';

/** [min, max] in cents; [0, 0] when empty so Infinity never reaches min/max attributes. */
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

export type PriceBucket = 'all' | 'under-30' | '30-50' | 'over-50';

export const PRICE_BUCKET_OPTIONS: FilterOption[] = [
  { label: 'All prices', value: 'all' },
  { label: 'Under $30', value: 'under-30' },
  { label: '$30–50', value: '30-50' },
  { label: 'Over $50', value: 'over-50' },
];

/** Bucket match on integer-cents price; unknown buckets match nothing. */
export function matchesPriceBucket(price: number, bucket: string): boolean {
  switch (bucket) {
    case 'all':
      return true;
    case 'under-30':
      return price < 3000;
    case '30-50':
      return price >= 3000 && price <= 5000;
    case 'over-50':
      return price > 5000;
    default:
      return false;
  }
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