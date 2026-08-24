// Owns the entire viewport (no Navbar/Footer/cart around it). Static markup + CSS only;
// the entrance is the reduced-motion-guarded `.uc-enter` fade-up in globals.css.
import BouquetSticker from "@/components/ui/BouquetSticker";
import PageWash from "@/components/ui/PageWash";

export default function UnderConstruction() {
  return (
    <section
      aria-labelledby="under-construction-title"
      className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background"
    >
      <div aria-hidden="true" className="wrapping-grid absolute inset-0 opacity-70" />
      <PageWash background="radial-gradient(ellipse 60% 45% at 50% 42%, rgba(249, 228, 228, 0.55), rgba(249, 228, 228, 0) 70%)" />
      <PageWash background="radial-gradient(ellipse 40% 30% at 82% 88%, rgba(243, 228, 211, 0.5), rgba(243, 228, 211, 0) 70%)" />

      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-border" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border" />

      <span aria-hidden="true" className="heart-float text-sm text-rose-deep" style={{ left: '16%', top: '22%', animationDuration: '8s' }}>♡</span>
      <span aria-hidden="true" className="heart-float text-xs text-rose-line" style={{ left: '82%', top: '26%', animationDuration: '10s', animationDelay: '2s' }}>♡</span>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="mx-auto w-full max-w-xl text-center">
          <div className="uc-enter flex justify-center">
            <BouquetSticker size={150} />
          </div>

          <p
            className="uc-enter mt-10 font-sans text-[11px] uppercase tracking-[0.3em] text-muted"
            style={{ animationDelay: '0.08s' }}
          >
            Under construction
          </p>

          <h1
            id="under-construction-title"
            className="uc-enter mt-4 font-sans text-4xl font-bold uppercase leading-[1.1] tracking-[0.05em] text-foreground sm:text-5xl"
            style={{ animationDelay: '0.16s' }}
          >
            Something lovely is <em className="font-hand font-normal normal-case tracking-normal text-rose-deep">blooming</em>
          </h1>

          <p
            className="uc-enter mx-auto mt-5 max-w-md font-sans text-base leading-relaxed text-muted"
            style={{ animationDelay: '0.24s' }}
          >
            We&rsquo;re putting the finishing touches on our garden of
            handcrafted ribbon flowers. Every petal is made by hand. The
            shop will open very soon.
          </p>

          <div
            className="uc-enter mt-10 flex flex-col items-center gap-4"
            style={{ animationDelay: '0.32s' }}
          >
            <div aria-hidden="true" className="flex items-center gap-3">
              <span className="h-px w-12 bg-rose-line/50" />
              <span className="text-xs leading-none text-rose-deep">&#10040;</span>
              <span className="h-px w-12 bg-rose-line/50" />
            </div>
            <p className="font-sans text-sm text-muted">
              Until then, contact us at{' '}
              <a
                href="mailto:contact@emilysflowers.ca"
                className="border-b border-rose-line/60 font-medium text-foreground transition-colors duration-300 hover:border-rose-line hover:text-rose-deep"
              >
                contact@emilysflowers.ca
              </a>
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-10 pb-8 pt-6 text-center">
        <p className="font-hand text-2xl leading-none text-rose-deep">
          Emily&rsquo;s Flowers: handcrafted ribbon flowers &amp; bouquets
        </p>
      </div>
    </section>
  );
}