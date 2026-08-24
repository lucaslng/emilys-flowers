import { Product } from '@/types';
import ProductCard from '@/components/shop/ProductCard';
import Reveal from '@/components/ui/Reveal';

interface ProductGridProps {
  products: Product[];
  emptyMessage?: string;
  /** Listing pages pass "h2" so the heading outline reads h1 → h2 → h3. */
  headingLevel?: 'h2' | 'h3';
}

export default function ProductGrid({
  products,
  emptyMessage = 'No products found.',
  headingLevel = 'h3',
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center border border-dashed border-rose-line/60 bg-surface px-6">
        <p className="font-sans text-base text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <Reveal stagger className="specimen-wall">
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