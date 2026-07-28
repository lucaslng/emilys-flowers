'use client';

import { useState, useMemo } from 'react';
import { getProductsByCategory, getPriceRange } from '@/lib/products';
import Container from '@/components/ui/Container';
import ProductGrid from '@/components/shop/ProductGrid';
import FilterBar from '@/components/shop/FilterBar';

const products = getProductsByCategory('flower');

const categoryOptions = [
  { label: 'All', value: 'all' },
  { label: 'Roses', value: 'rose' },
  { label: 'Peonies', value: 'peony' },
  { label: 'Dahlias', value: 'dahlia' },
  { label: 'Ranunculus', value: 'ranunculus' },
  { label: 'Wildflowers', value: 'wildflower' },
];

const sortOptions = [
  { label: 'Price: Low to High', value: 'price-asc' },
  { label: 'Price: High to Low', value: 'price-desc' },
  { label: 'Name: A-Z', value: 'name-asc' },
  { label: 'Name: Z-A', value: 'name-desc' },
];

export default function FlowersPageClient() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSort, setSelectedSort] = useState('price-asc');
  const initialPriceRange = useMemo(() => getPriceRange(products), []);
  const [selectedPriceRange, setSelectedPriceRange] = useState<[number, number]>(
    initialPriceRange
  );

  const filtered = useMemo(() => {
    let result = [...products];

    // Filter by tag/category
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
  }, [selectedCategory, selectedSort, selectedPriceRange]);

  return (
    <div className="py-12 sm:py-16">
      <Container>
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="font-serif text-3xl font-bold text-[#4A3B3B] sm:text-4xl">
            Individual Flowers
          </h1>
          <p className="mt-3 font-sans text-base text-[#8B7B7B]">
            Choose from our collection of handcrafted single-stem ribbon flowers
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
          emptyMessage="No flowers match your filters. Try adjusting your criteria."
        />
      </Container>
    </div>
  );
}
