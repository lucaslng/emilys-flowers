import { getFeaturedProducts } from '@/lib/stripe-catalog';
import Container from '@/components/ui/Container';
import ProductCard from '@/components/shop/ProductCard';
import Reveal from '@/components/ui/Reveal';
import StarMotif from '@/components/ui/StarMotif';

/**
 * FeaturedBouquets — "the bouquet wall". NOT a symmetric triptych: three
 * gift-tag cards overlap at different heights and tilts, like keepsakes
 * pinned to a board. The center card is emphasized (rose border + soft
 * shadow) and lifted above its neighbours. Reveal animates the outer
 * wrappers; the tilts live on inner divs so GSAP and CSS transforms never
 * fight.
 */
export default async function FeaturedBouquets() {
  const featured = await getFeaturedProducts();

  return (
    <section className="relative isolate overflow-hidden bg-background py-16 sm:py-24">
      {/* Faint warm wash behind the wall */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 55% 45% at 50% 20%, rgba(249, 228, 228, 0.4), rgba(254, 250, 245, 0) 70%)',
        }}
      />

      <Container className="relative z-10">
        <Reveal>
          <div className="relative max-w-xl">
            <StarMotif size={44} className="absolute -left-8 -top-6 text-rose opacity-70" />
            <p className="font-hand text-3xl leading-none text-rose-deep">
              the ones everyone asks about ♡
            </p>
            <h2 className="mt-3 font-sans text-3xl font-bold uppercase tracking-[0.06em] text-foreground sm:text-4xl">
              Featured Bouquets
            </h2>
            <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
              Our most beloved handcrafted arrangements — each one folded to
              order.
            </p>
          </div>
        </Reveal>

        {/* Asymmetric collage: wide center, tilted flanks, varied heights */}
        <Reveal
          stagger
          className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-12 lg:items-start lg:gap-6"
        >
          {featured.map((product, i) => {
            const isCenter = i === 1;
            return (
              <div
                key={product.id}
                className={
                  isCenter
                    ? 'md:order-first md:col-span-2 lg:order-none lg:col-span-6 lg:z-10 lg:-mt-8'
                    : i === 0
                      ? 'lg:col-span-3 lg:mt-12'
                      : 'lg:col-span-3 lg:mt-20'
                }
              >
                <div
                  className={
                    isCenter
                      ? 'lg:rotate-[0.6deg]'
                      : i === 0
                        ? 'lg:-rotate-2'
                        : 'lg:rotate-[1.6deg]'
                  }
                >
                  <ProductCard
                    product={product}
                    emphasized={isCenter}
                    priority
                  />
                </div>
              </div>
            );
          })}
        </Reveal>
      </Container>
    </section>
  );
}