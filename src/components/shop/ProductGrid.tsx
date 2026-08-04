import { Product } from '@/types';
import ProductCard from '@/components/shop/ProductCard';
import Reveal from '@/components/ui/Reveal';

interface ProductGridProps {
  products: Product[];
  emptyMessage?: string;
  /** Heading level for product names inside cards (default "h3"). Listing
   *  pages pass "h2" so the heading outline reads h1 → h2 → h3. */
  headingLevel?: 'h2' | 'h3';
}

export default function ProductGrid({
  products,
  emptyMessage = 'No products found.',
  headingLevel = 'h3',
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-[#F0E0E0] bg-[#FFF5F5]">
        <p className="font-sans text-base text-[#7A6868]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <Reveal stagger className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          headingLevel={headingLevel}
        />
      ))}
    </Reveal>
  );
}
