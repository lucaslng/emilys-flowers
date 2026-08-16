import Link from 'next/link';
import Button from '@/components/ui/Button';
import RibbonRose from '@/components/ui/RibbonRose';
import StarMotif from '@/components/ui/StarMotif';

/**
 * Hero — "the gift box". Off-center composition: the headline block sits on
 * the left, a hand-folded ribbon rose rests on a tilted wrapping-paper panel
 * to the right, with washi tape, a handwritten annotation, floating hearts,
 * and a diagonal ribbon band. Centered single-subject, generous negative
 * space — like opening a carefully wrapped gift.
 */
export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Frosted wrapping-paper grid + soft satin light */}
      <div aria-hidden="true" className="wrapping-grid absolute inset-0" />
      <div aria-hidden="true" className="vignette absolute inset-0" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 42% 34% at 78% 30%, rgba(243, 228, 211, 0.5), rgba(243, 228, 211, 0) 70%)',
        }}
      />

      {/* Diagonal ribbon band — the crisp geometric counterpoint */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-10 h-10 w-[130%] -rotate-6 bg-blush/70"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-[4.6rem] h-2 w-[130%] -rotate-6 bg-rose-line/40"
      />

      {/* Floating hearts — decorative, reduced-motion-guarded via .heart-float */}
      <span aria-hidden="true" className="heart-float text-sm text-rose-deep" style={{ left: '12%', top: '18%', animationDuration: '7s' }}>♡</span>
      <span aria-hidden="true" className="heart-float text-xs text-rose-line" style={{ left: '84%', top: '14%', animationDuration: '9s', animationDelay: '1.5s' }}>♡</span>
      <span aria-hidden="true" className="heart-float text-base text-rose-deep" style={{ left: '70%', top: '72%', animationDuration: '8s', animationDelay: '3s' }}>♡</span>

      <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-14 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] lg:gap-8 lg:px-8 lg:py-28">
        {/* Headline block */}
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
            Every petal is cut, folded, and stitched by hand — ribbon flowers
            that never wilt, made to your palette and kept for a lifetime.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Button as={Link} href="/bouquets" variant="primary" size="lg">
              Shop Bouquets
            </Button>
            <Button as={Link} href="/flowers" variant="secondary" size="lg">
              Browse Flowers
            </Button>
          </div>
        </div>

        {/* The rose — tilted wrapping-paper panel */}
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="relative rotate-2 border border-border bg-background/90 p-8 backdrop-blur-[1px] sm:p-10">
            {/* Washi tape corners */}
            <span aria-hidden="true" className="washi absolute -top-3 left-8 h-6 w-24 -rotate-3" />
            <span aria-hidden="true" className="washi absolute -bottom-3 right-10 h-6 w-20 rotate-2" />

            {/* Wrapping grid inside the panel */}
            <div aria-hidden="true" className="wrapping-grid absolute inset-0 opacity-60" />

            <div className="relative flex justify-center">
              <RibbonRose size={260} className="animate-float" />
            </div>

            {/* Handwritten annotation with arrow */}
            <div className="relative mt-2 flex justify-end">
              <svg
                aria-hidden="true"
                width="90"
                height="34"
                viewBox="0 0 90 34"
                fill="none"
                className="line-boil text-rose-deep"
              >
                <path
                  d="M4 26 C 30 22 52 14 84 8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  fill="none"
                />
                <path d="M84 8 L 74 6 M 84 8 L 80 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
              </svg>
              <span className="font-hand text-3xl leading-none text-rose-deep">
                our roses ♡
              </span>
            </div>
          </div>

          {/* Origami star — geometric anchor, slow spin */}
          <StarMotif
            size={72}
            className="animate-star absolute -left-6 -top-6 text-rose opacity-80"
          />
        </div>
      </div>
    </section>
  );
}