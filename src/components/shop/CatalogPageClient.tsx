'use client';

import { useState, useMemo } from 'react';
import { Product } from '@/types';
import { getPriceRange, type FilterOption } from '@/lib/product-utils';
import Container from '@/components/ui/Container';
import ProductGrid from '@/components/shop/ProductGrid';
import FilterBar from '@/components/shop/FilterBar';
import StarMotif from '@/components/ui/StarMotif';
import ArrowFlourish from '@/components/shop/ArrowFlourish';
import PageWash from '@/components/ui/PageWash';

const sortOptions = [
  { label: 'Price: Low to High', value: 'price-asc' },
  { label: 'Price: High to Low', value: 'price-desc' },
  { label: 'Name: A-Z', value: 'name-asc' },
  { label: 'Name: Z-A', value: 'name-desc' },
];

interface CatalogPageClientProps {
  products: Product[];
  title: string;
  /** Handwritten count line after the number. */
  countLabel: string;
  description: string;
  /** Handwritten annotation beside the arrow. */
  annotation: string;
  /** The two catalogues deliberately mirror each other — do not flatten into one alignment. */
  align?: 'left' | 'right';
  /** Full CSS background for the corner wash (position + tint vary per page). */
  washGradient: string;
  emptyMessage: string;
  categoryOptions: FilterOption[];
  matchCategory: (product: Product, value: string) => boolean;
  secondaryCategoryOptions?: FilterOption[];
  matchSecondaryCategory?: (product: Product, value: string) => boolean;
}

/** Shared listing client for /flowers and /bouquets; per-page identity arrives via props. */
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

  const annotationSpan = (
    <span className="font-hand text-2xl leading-none text-rose-deep">
      {annotation}
    </span>
  );

  return (
    <div className="relative isolate overflow-hidden pb-16 pt-12 sm:pb-24 sm:pt-16">
      <PageWash background={washGradient} />

      <Container className="relative z-10">
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
          <div
            className={`mt-3 flex items-center gap-2${
              isRightAligned ? ' justify-end' : ''
            }`}
          >
            {isRightAligned ? (
              <>
                {annotationSpan}
                <ArrowFlourish flip={isRightAligned} />
              </>
            ) : (
              <>
                <ArrowFlourish />
                {annotationSpan}
              </>
            )}
          </div>
        </div>

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
