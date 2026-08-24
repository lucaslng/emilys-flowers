'use client';

import { useState, useMemo } from 'react';
import { Product } from '@/types';
import { getPriceRange, type FilterOption } from '@/lib/product-utils';
import Container from '@/components/ui/Container';
import ProductGrid from '@/components/shop/ProductGrid';
import FilterBar from '@/components/shop/FilterBar';
import StarMotif from '@/components/ui/StarMotif';

const sortOptions = [
  { label: 'Price: Low to High', value: 'price-asc' },
  { label: 'Price: High to Low', value: 'price-desc' },
  { label: 'Name: A-Z', value: 'name-asc' },
  { label: 'Name: Z-A', value: 'name-desc' },
];

interface CatalogPageClientProps {
  products: Product[];
  title: string;
  /** Handwritten count line after the number, e.g. "hand-folded blooms". */
  countLabel: string;
  description: string;
  /** Handwritten annotation beside the arrow, e.g. "pick your favourites". */
  annotation: string;
  /**
   * The two catalogues deliberately mirror each other: "left" is the
   * garden-catalogue plate, "right" leans against the page edge with a
   * flipped arrow. Do not flatten into one alignment.
   */
  align?: 'left' | 'right';
  /** Full CSS background for the corner wash (position + tint vary per page). */
  washGradient: string;
  emptyMessage: string;
  categoryOptions: FilterOption[];
  matchCategory: (product: Product, value: string) => boolean;
  secondaryCategoryOptions?: FilterOption[];
  matchSecondaryCategory?: (product: Product, value: string) => boolean;
}

/**
 * CatalogPageClient — shared listing client for /flowers and /bouquets.
 * Per-page identity (copy, mirroring, wash tint, filter dimensions) arrives
 * entirely via props so both routes keep their exact existing markup.
 */
export default function CatalogPageClient({
  products,
  title,
  countLabel,
  description,
  annotation,
  align = 'left',
  washGradient,
  emptyMessage,
  categoryOptions,
  matchCategory,
  secondaryCategoryOptions,
  matchSecondaryCategory,
}: CatalogPageClientProps) {
  const isRightAligned = align === 'right';
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSecondaryCategory, setSelectedSecondaryCategory] =
    useState('all');
  const [selectedSort, setSelectedSort] = useState('price-asc');
  const initialPriceRange = useMemo(() => getPriceRange(products), [products]);
  const [selectedPriceRange, setSelectedPriceRange] = useState<[number, number]>(
    initialPriceRange
  );

  const filtered = useMemo(() => {
    let result = [...products];

    if (selectedCategory !== 'all') {
      result = result.filter((p) => matchCategory(p, selectedCategory));
    }

    if (matchSecondaryCategory && selectedSecondaryCategory !== 'all') {
      result = result.filter(
        (p) => matchSecondaryCategory(p, selectedSecondaryCategory)
      );
    }

    result = result.filter(
      (p) =>
        p.price >= selectedPriceRange[0] && p.price <= selectedPriceRange[1]
    );

    switch (selectedSort) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'name-asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
    }

    return result;
  }, [
    matchCategory,
    matchSecondaryCategory,
    selectedCategory,
    selectedSecondaryCategory,
    selectedSort,
    selectedPriceRange,
    products,
  ]);

  const arrowSvg = (
    <svg aria-hidden="true" width="64" height="20" viewBox="0 0 64 20" fill="none" className={`line-boil text-rose-line${isRightAligned ? ' -scale-x-100' : ''}`}>
      <path d="M2 16 C 20 12 38 6 60 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M60 3 L 51 2 M 60 3 L 56 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  );
  const annotationSpan = (
    <span className="font-hand text-2xl leading-none text-rose-deep">
      {annotation}
    </span>
  );

  return (
    <div className="relative isolate overflow-hidden pb-16 pt-12 sm:pb-24 sm:pt-16">
      {/* Soft corner wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: washGradient,
        }}
      />

      <Container className="relative z-10">
        {/* Header plate */}
        <div
          className={
            isRightAligned
              ? 'relative ml-auto max-w-2xl text-right'
              : 'relative max-w-2xl'
          }
        >
          <StarMotif
            size={52}
            className={`absolute ${isRightAligned ? '-right-9' : '-left-9'} -top-7 text-rose opacity-70`}
          />
          <p className="font-hand text-3xl leading-none text-rose-deep">
            {products.length} {countLabel} ♡
          </p>
          <h1 className="mt-3 font-sans text-3xl font-bold uppercase tracking-[0.06em] text-foreground sm:text-5xl">
            {title}
          </h1>
          <p
            className={`mt-4 max-w-md font-sans text-sm leading-relaxed text-muted sm:text-base${
              isRightAligned ? ' ml-auto' : ''
            }`}
          >
            {description}
          </p>
          {/* Hand-drawn arrow annotation */}
          <div
            className={`mt-3 flex items-center gap-2${
              isRightAligned ? ' justify-end' : ''
            }`}
          >
            {isRightAligned ? (
              <>
                {annotationSpan}
                {arrowSvg}
              </>
            ) : (
              <>
                {arrowSvg}
                {annotationSpan}
              </>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mt-10">
          <FilterBar
            categories={categoryOptions}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            secondaryCategories={secondaryCategoryOptions}
            selectedSecondaryCategory={selectedSecondaryCategory}
            onSecondaryCategoryChange={setSelectedSecondaryCategory}
            sortOptions={sortOptions}
            selectedSort={selectedSort}
            onSortChange={setSelectedSort}
            priceRange={initialPriceRange}
            selectedPriceRange={selectedPriceRange}
            onPriceRangeChange={setSelectedPriceRange}
          />
        </div>

        {/* Product Wall */}
        <div className="mt-12">
          <ProductGrid
            products={filtered}
            headingLevel="h2"
            emptyMessage={emptyMessage}
          />
        </div>
      </Container>
    </div>
  );
}
