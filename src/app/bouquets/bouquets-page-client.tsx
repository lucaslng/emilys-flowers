'use client';

import { useState, useMemo } from 'react';
import { Product } from '@/types';
import { getPriceRange } from '@/lib/product-utils';
import Container from '@/components/ui/Container';
import ProductGrid from '@/components/shop/ProductGrid';
import FilterBar from '@/components/shop/FilterBar';

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
    <div className="py-12 sm:py-16">
      <Container>
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="font-serif text-3xl font-bold text-[#4A3B3B] sm:text-4xl">
            Bouquet Collections
          </h1>
          <p className="mt-3 font-sans text-base text-[#7A6868]">
            Explore our curated collections of handcrafted ribbon flower
            bouquets
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8">
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

        {/* Product Grid */}
        <ProductGrid
          products={filtered}
          headingLevel="h2"
          emptyMessage="No bouquets match your filters. Try adjusting your criteria."
        />
      </Container>
    </div>
  );
}