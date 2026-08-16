'use client';

import { useState, useMemo } from 'react';
import { Product } from '@/types';
import {
  getFlowerTypes,
  getFlowerColors,
  getPriceRange,
} from '@/lib/product-utils';
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

interface FlowersPageClientProps {
  products: Product[];
}

/**
 * FlowersPageClient — "the garden catalogue". The header is a left-aligned
 * catalogue plate (title + handwritten annotation + star motif); filters
 * run in a stitched index card; products hang on the staggered specimen wall.
 */
export default function FlowersPageClient({
  products,
}: FlowersPageClientProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedColor, setSelectedColor] = useState('all');
  const [selectedSort, setSelectedSort] = useState('price-asc');
  const initialPriceRange = useMemo(() => getPriceRange(products), [products]);
  const [selectedPriceRange, setSelectedPriceRange] = useState<[number, number]>(
    initialPriceRange
  );

  const categoryOptions = useMemo(() => getFlowerTypes(products), [products]);
  const colorOptions = useMemo(() => getFlowerColors(products), [products]);

  const filtered = useMemo(() => {
    let result = [...products];

    // Filter by flower type
    if (selectedCategory !== 'all') {
      result = result.filter((p) => p.flowerType === selectedCategory);
    }

    // Filter by color
    if (selectedColor !== 'all') {
      result = result.filter((p) => p.color === selectedColor);
    }

    // Filter by price range
    result = result.filter(
      (p) =>
        p.price >= selectedPriceRange[0] && p.price <= selectedPriceRange[1]
    );

    // Sort
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
  }, [selectedCategory, selectedColor, selectedSort, selectedPriceRange, products]);

  return (
    <div className="relative isolate overflow-hidden pb-16 pt-12 sm:pb-24 sm:pt-16">
      {/* Soft champagne wash, upper-right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 45% 35% at 85% 8%, rgba(243, 228, 211, 0.55), rgba(243, 228, 211, 0) 70%)',
        }}
      />

      <Container className="relative z-10">
        {/* Header — catalogue plate */}
        <div className="relative max-w-2xl">
          <StarMotif size={52} className="absolute -left-9 -top-7 text-rose opacity-70" />
          <p className="font-hand text-3xl leading-none text-rose-deep">
            {products.length} hand-folded blooms ♡
          </p>
          <h1 className="mt-3 font-sans text-3xl font-bold uppercase tracking-[0.06em] text-foreground sm:text-5xl">
            Individual Flowers
          </h1>
          <p className="mt-4 max-w-md font-sans text-sm leading-relaxed text-muted sm:text-base">
            Choose from our collection of handcrafted single-stem ribbon
            flowers — roses, plumerias, dahlias, and more.
          </p>
          {/* Hand-drawn arrow annotation */}
          <div className="mt-3 flex items-center gap-2">
            <svg aria-hidden="true" width="64" height="20" viewBox="0 0 64 20" fill="none" className="text-rose-line">
              <path d="M2 16 C 20 12 38 6 60 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
              <path d="M60 3 L 51 2 M 60 3 L 56 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
            </svg>
            <span className="font-hand text-2xl leading-none text-rose-deep">
              pick your favourites
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-10">
          <FilterBar
            categories={categoryOptions}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            secondaryCategories={colorOptions}
            selectedSecondaryCategory={selectedColor}
            onSecondaryCategoryChange={setSelectedColor}
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
            emptyMessage="No flowers match your filters. Try adjusting your criteria."
          />
        </div>
      </Container>
    </div>
  );
}