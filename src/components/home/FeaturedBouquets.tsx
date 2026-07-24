import { getFeaturedProducts } from '@/lib/products';
import Container from '@/components/ui/Container';
import ProductCard from '@/components/shop/ProductCard';
import Reveal from '@/components/ui/Reveal';
import SquiggleUnderline from '@/components/ui/SquiggleUnderline';

export default function FeaturedBouquets() {
  const featured = getFeaturedProducts();

  return (
    <section className="flex min-h-[calc(100vh-4rem)] flex-col justify-center bg-[#FFFAFA] py-8 sm:py-12">
      <Container>
        <Reveal>
          <div className="text-center">
            <h2 className="font-serif text-3xl font-bold text-[#4A3B3B] sm:text-4xl">
              Featured Bouquets
            </h2>
            <p className="mt-2 font-sans text-base text-[#8B7B7B]">
              Our most beloved handcrafted arrangements
            </p>
            <div className="mt-2 flex justify-center">
              <SquiggleUnderline />
            </div>
          </div>
        </Reveal>

        {/* Center-emphasis triptych: the middle card is wider (so its square
            image is genuinely larger), lifted slightly, and emphasized.
            Mobile: center first via source order. Tablet: center spans full
            width on top. Desktop: 1fr / 1.35fr / 1fr with a small lift. */}
        <Reveal
          stagger
          className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start lg:grid-cols-[1fr_1.35fr_1fr] lg:items-end"
        >
          {featured.map((product, i) => {
            const isCenter = i === 1;
            return (
              <ProductCard
                key={product.id}
                product={product}
                emphasized={isCenter}
                // Mobile: natural stack (center is index 1, between the sides).
                // Tablet (2-col): center spans both columns and leads on top.
                // Desktop (3-col): center track is wider; lift it slightly.
                className={
                  isCenter
                    ? 'md:order-first md:col-span-2 lg:order-none lg:col-span-1 lg:-mt-2'
                    : ''
                }
              />
            );
          })}
        </Reveal>
      </Container>
    </section>
  );
}