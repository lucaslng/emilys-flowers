'use client';

import { Product } from '@/types';
import CatalogPageClient from '@/components/shop/CatalogPageClient';
import type { FilterOption } from '@/lib/product-utils';

const categoryOptions: FilterOption[] = [{ label: 'All', value: 'all' }];

interface BouquetsPageClientProps {
  products: Product[];
}

export default function BouquetsPageClient({
  products,
}: BouquetsPageClientProps) {
  return (
    <CatalogPageClient
      products={products}
      title="Bouquet Collections"
      countLabel="wrapped & ready"
      description="Explore our collection of handcrafted ribbon flower bouquets!"
      annotation="gifts that last"
      align="right"
      washGradient="radial-gradient(ellipse 45% 35% at 12% 8%, rgba(249, 228, 228, 0.55), rgba(249, 228, 228, 0) 70%)"
      emptyMessage="No bouquets match your filters. Try adjusting your criteria."
      categoryOptions={categoryOptions}
      matchCategory={(product, value) => product.tags.includes(value)}
    />
  );
}
