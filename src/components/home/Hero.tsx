import Link from 'next/link';
import Button from '@/components/ui/Button';
import BouquetSticker from '@/components/ui/BouquetSticker';
import StarMotif from '@/components/ui/StarMotif';
import ArrowFlourish from '@/components/shop/ArrowFlourish';
import PageWash from '@/components/ui/PageWash';

/**
 * Hero — "the gift box". Off-center composition: the headline block sits on
 * the left, a bouquet sticker rests on a tilted wrapping-paper panel to the
 * right, with washi tape, a handwritten annotation, floating hearts, and a
 * diagonal ribbon band. Centered single-subject, generous negative space —
 * like opening a carefully wrapped gift.
 */
export default function Hero({ showFlowers = true }: { showFlowers?: boolean }) {
  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden="true" className="wrapping-grid absolute inset-0" />
      <div aria-hidden="true" className="vignette absolute inset-0" />
      <PageWash background="radial-gradient(ellipse 42% 34% at 78% 30%, rgba(243, 228, 211, 0.5), rgba(243, 228, 211, 0) 70%)" />

      {/* Kept top-right so its rotated left end never dips into the headline. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-5 h-10 w-[45%] -rotate-6 bg-blush/70"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-[3.35rem] h-2 w-[45%] -rotate-6 bg-rose-line/40"
      />

      <span aria-hidden="true" className="heart-float text-sm text-rose-deep" style={{ left: '12%', top: '18%', animationDuration: '7s' }}>♡</span>
      <span aria-hidden="true" className="heart-float text-xs text-rose-line" style={{ left: '84%', top: '14%', animationDuration: '9s', animationDelay: '1.5s' }}>♡</span>
      <span aria-hidden="true" className="heart-float text-base text-rose-deep" style={{ left: '70%', top: '72%', animationDuration: '8s', animationDelay: '3s' }}>♡</span>

      <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-14 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] lg:gap-8 lg:px-8 lg:py-28">
        <div className="max-w-xl">
          <p className="font-hand text-3xl leading-none text-rose-deep">
            handcrafted ribbon flowers ♡
          </p>
          <h1 className="mt-4 font-sans text-4xl font-bold uppercase leading-[1.08] tracking-[0.04em] text-foreground sm:text-5xl lg:text-6xl">
            Forever blooms,
            <br />
            folded by hand
          </h1>
          <p className="mt-6 max-w-md font-sans text-base leading-relaxed text-muted">
            Every petal is cut, folded, and stitched by hand - ribbon flowers
            that never wilt, made to your palette and kept for a lifetime.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Button as={Link} href="/bouquets" variant="primary" size="lg">
              Shop Bouquets
            </Button>
            {showFlowers && (
              <Button as={Link} href="/flowers" variant="secondary" size="lg">
                Browse Flowers
              </Button>
            )}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="relative rotate-2 border border-border bg-background/90 p-8 backdrop-blur-[1px] sm:p-10">
            <span aria-hidden="true" className="washi absolute -top-3 left-8 h-6 w-24 -rotate-3" />
            <span aria-hidden="true" className="washi absolute -bottom-3 right-10 h-6 w-20 rotate-2" />

            <div aria-hidden="true" className="wrapping-grid absolute inset-0 opacity-60" />

            <div className="relative flex justify-center py-5">
              <BouquetSticker size={260} tilt={10} />
            </div>

            <div className="relative mt-2 flex justify-end">
              <ArrowFlourish size="lg" className="line-boil text-rose-deep" />
              <span className="font-hand text-3xl leading-none text-rose-deep">
                our bouquets ♡
              </span>
            </div>
          </div>

          <StarMotif
            size={72}
            className="animate-star absolute -left-6 -top-6 text-rose opacity-80"
          />
        </div>
      </div>
    </section>
  );
}