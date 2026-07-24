import { Product } from '@/types';
import ProductCard from '@/components/shop/ProductCard';
import Reveal from '@/components/ui/Reveal';

interface ProductGridProps {
  products: Product[];
  emptyMessage?: string;
}

export default function ProductGrid({
  products,
  emptyMessage = 'No products found.',
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-[#F0E0E0] bg-[#FFF5F5]">
        <p className="font-sans text-base text-[#8B7B7B]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <Reveal stagger className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </Reveal>
  );
}
