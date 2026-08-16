import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import StarMotif from '@/components/ui/StarMotif';

const reasons = [
  {
    title: 'Made by Hand',
    description:
      'My BF and I cut, fold, and assemble every petal by hand.',
    icon: '✂',
  },
  {
    title: 'Made to Keep',
    description:
      'Unlike regular flowers, my ribbon flowers will last you for the rest of time.',
    icon: '♡',
  },
  {
    title: 'Made to Your Palette',
    description:
      'Custom color, style, and arrangement requests are welcome for weddings, interiors, and gifts. Feel free to message me on Instagram @emilysflowers_!',
    icon: '✿',
  },
];

/**
 * WhyChooseUs — "the maker's notebook". A stitched, ruled panel holds three
 * numbered maker's notes, each with a hand-drawn icon and a dashed seam.
 * The heading block is a tilted, washi-taped card overlapping the panel —
 * no symmetric two-column layout.
 */
export default function WhyChooseUs() {
  return (
    <section
      id="why-emilys-flowers"
      className="relative isolate overflow-hidden bg-surface py-16 sm:py-24"
    >
      {/* Warm champagne wash, lower-right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 85% 90%, rgba(243, 228, 211, 0.6), rgba(243, 228, 211, 0) 70%)',
        }}
      />

      <Container className="relative z-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-14">
          {/* Heading — tilted card, taped to the notebook */}
          <Reveal className="lg:pt-10">
            <div className="relative -rotate-1 border border-border bg-background p-6 sm:p-8">
              <span aria-hidden="true" className="washi absolute -top-3 right-8 h-6 w-24 rotate-2" />
              <StarMotif size={40} className="absolute -right-3 -top-3 text-rose opacity-70" />
              <p className="font-hand text-3xl leading-none text-rose-deep">
                our promise ♡
              </p>
              <h2 className="mt-3 font-sans text-3xl font-bold uppercase tracking-[0.06em] text-foreground sm:text-4xl">
                Why Emily&rsquo;s Flowers
              </h2>
              <p className="mt-4 font-sans text-sm leading-relaxed text-muted">
                Three standards behind every arrangement.
              </p>
            </div>
          </Reveal>

          {/* Notebook page — stitched border + ruled lines */}
          <div className="stitch relative bg-background px-6 py-8 sm:px-10 sm:py-10">
            {/* Ruled lines — faint warm hairlines */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(to bottom, transparent 0, transparent 43px, rgba(177, 110, 110, 0.09) 43px, rgba(177, 110, 110, 0.09) 44px)',
              }}
            />
            <Reveal stagger className="relative">
              {reasons.map((reason, i) => (
                <div
                  key={reason.title}
                  className="group grid grid-cols-[auto_1fr] items-start gap-x-5 py-7 first:pt-0 last:pb-0 sm:gap-x-7"
                >
                  {/* Hand-drawn icon + number */}
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 items-center justify-center border border-rose-line/70 bg-blush/60 text-lg text-rose-deep"
                    >
                      {reason.icon}
                    </span>
                    <span
                      aria-hidden="true"
                      className="font-sans text-[10px] tabular-nums tracking-[0.2em] text-muted"
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div>
                    <h3 className="gift-name font-sans text-lg font-bold uppercase tracking-[0.1em] text-foreground sm:text-xl">
                      {reason.title}
                    </h3>
                    <p className="mt-2 max-w-xl font-sans text-sm leading-relaxed text-muted sm:text-base">
                      {reason.description}
                    </p>
                  </div>
                  {/* Dashed seam between notes */}
                  {i < reasons.length - 1 && (
                    <div
                      aria-hidden="true"
                      className="gift-divider col-span-2 mt-7"
                    />
                  )}
                </div>
              ))}
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}