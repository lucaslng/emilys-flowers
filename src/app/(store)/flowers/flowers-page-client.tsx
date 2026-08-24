'use client';

import { useMemo } from 'react';
import { Product } from '@/types';
import { getFlowerTypes, getFlowerColors } from '@/lib/product-utils';
import CatalogPageClient from '@/components/shop/CatalogPageClient';

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
  const categoryOptions = useMemo(() => getFlowerTypes(products), [products]);
  const colorOptions = useMemo(() => getFlowerColors(products), [products]);

  return (
    <CatalogPageClient
      products={products}
      title="Individual Flowers"
      countLabel="hand-folded blooms"
      description="Choose from our collection of handcrafted single-stem ribbon flowers — roses, plumerias, dahlias, and more."
      annotation="pick your favourites"
      align="left"
      washGradient="radial-gradient(ellipse 45% 35% at 85% 8%, rgba(243, 228, 211, 0.55), rgba(243, 228, 211, 0) 70%)"
      emptyMessage="No flowers match your filters. Try adjusting your criteria."
      categoryOptions={categoryOptions}
      matchCategory={(product, value) => product.flowerType === value}
      secondaryCategoryOptions={colorOptions}
      matchSecondaryCategory={(product, value) => product.color === value}
    />
  );
}
