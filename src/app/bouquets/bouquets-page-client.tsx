'use client';

import { useState, useMemo } from 'react';
import { Product } from '@/types';
import { getPriceRange } from '@/lib/product-utils';
import Container from '@/components/ui/Container';
import ProductGrid from '@/components/shop/ProductGrid';
import FilterBar from '@/components/shop/FilterBar';
import StarMotif from '@/components/ui/StarMotif';

const categoryOptions = [{ label: 'All', value: 'all' }];

const sortOptions = [
  { label: 'Price: Low to High', value: 'price-asc' },
  { label: 'Price: High to Low', value: 'price-desc' },
  { label: 'Name: A-Z', value: 'name-asc' },
  { label: 'Name: Z-A', value: 'name-desc' },
];

interface BouquetsPageClientProps {
  products: Product[];
}

/**
 * BouquetsPageClient — "the gift shelf". A right-leaning header plate, the
 * stitched filter index, then the staggered specimen wall (three bouquets
 * hang at different heights, like gifts on a mantel).
 */
export default function BouquetsPageClient({
  products,
}: BouquetsPageClientProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSort, setSelectedSort] = useState('price-asc');
  const initialPriceRange = useMemo(() => getPriceRange(products), [products]);
  const [selectedPriceRange, setSelectedPriceRange] = useState<[number, number]>(
    initialPriceRange
  );

  const filtered = useMemo(() => {
    let result = [...products];

    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter((p) => p.tags.includes(selectedCategory));
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
  }, [selectedCategory, selectedSort, selectedPriceRange, products]);

  return (
    <div className="relative isolate overflow-hidden pb-16 pt-12 sm:pb-24 sm:pt-16">
      {/* Soft blush wash, upper-left */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 45% 35% at 12% 8%, rgba(249, 228, 228, 0.55), rgba(249, 228, 228, 0) 70%)',
        }}
      />

      <Container className="relative z-10">
        {/* Header — gift-shelf plate, right-leaning */}
        <div className="relative ml-auto max-w-2xl text-right">
          <StarMotif size={52} className="absolute -right-9 -top-7 text-rose opacity-70" />
          <p className="font-hand text-3xl leading-none text-rose-deep">
            {products.length} wrapped &amp; ready ♡
          </p>
          <h1 className="mt-3 font-sans text-3xl font-bold uppercase tracking-[0.06em] text-foreground sm:text-5xl">
            Bouquet Collections
          </h1>
          <p className="ml-auto mt-4 max-w-md font-sans text-sm leading-relaxed text-muted sm:text-base">
            Explore our curated collections of handcrafted ribbon flower
            bouquets — romantic, rustic, seasonal, and more.
          </p>
          {/* Hand-drawn arrow annotation */}
          <div className="mt-3 flex items-center justify-end gap-2">
            <span className="font-hand text-2xl leading-none text-rose-deep">
              gifts that last
            </span>
            <svg aria-hidden="true" width="64" height="20" viewBox="0 0 64 20" fill="none" className="line-boil text-rose-line -scale-x-100">
              <path d="M2 16 C 20 12 38 6 60 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
              <path d="M60 3 L 51 2 M 60 3 L 56 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
            </svg>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-10">
          <FilterBar
            categories={categoryOptions}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
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
            emptyMessage="No bouquets match your filters. Try adjusting your criteria."
          />
        </div>
      </Container>
    </div>
  );
}