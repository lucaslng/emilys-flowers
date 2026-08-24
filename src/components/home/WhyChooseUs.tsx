import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';
import StarMotif from '@/components/ui/StarMotif';
import PageWash from '@/components/ui/PageWash';

type ReasonIconName = 'scissors' | 'heart' | 'bloom';

const reasons: {
  title: string;
  description: string;
  icon: ReasonIconName;
}[] = [
  {
    title: 'Made by Hand',
    description:
      'My BF and I cut, fold, and assemble every petal by hand.',
    icon: 'scissors',
  },
  {
    title: 'Made to Keep',
    description:
      'Unlike regular flowers, my ribbon flowers will last you for the rest of time.',
    icon: 'heart',
  },
  {
    title: 'Made to Your Palette',
    description:
      'Custom color, style, and arrangement requests are welcome for weddings, interiors, and gifts. Feel free to message me on Instagram @emilysflowers_!',
    icon: 'bloom',
  },
];

/** Hand-drawn stroke-only line-art icons; `currentColor` drives the tone. */
function ReasonIcon({ name }: { name: ReasonIconName }) {
  const common = {
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (name === 'scissors') {
    return (
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        className="line-boil-fine text-rose-deep"
      >
        <circle cx="7" cy="7" r="2.4" {...common} />
        <circle cx="17" cy="7" r="2.4" {...common} />
        <path d="M9.4 9.4 L 20 20" {...common} />
        <path d="M14.6 9.4 L 4 20" {...common} />
      </svg>
    );
  }

  if (name === 'heart') {
    return (
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        className="line-boil-fine text-rose-deep"
      >
        <path
          d="M12 20 C 8.5 16.5 4.5 13.5 4.5 9.5 C 4.5 6.5 6.5 4.5 9 4.5 C 10.5 4.5 11.5 5.5 12 7 C 12.5 5.5 13.5 4.5 15 4.5 C 17.5 4.5 19.5 6.5 19.5 9.5 C 19.5 13.5 15.5 16.5 12 20 Z"
          {...common}
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      className="line-boil-fine text-rose-deep"
    >
      <g {...common}>
        <path d="M12 12 C 10.4 8.6 10.4 5.6 12 4.2 C 13.6 5.6 13.6 8.6 12 12" />
        <path d="M12 12 C 10.4 8.6 10.4 5.6 12 4.2 C 13.6 5.6 13.6 8.6 12 12" transform="rotate(72 12 12)" />
        <path d="M12 12 C 10.4 8.6 10.4 5.6 12 4.2 C 13.6 5.6 13.6 8.6 12 12" transform="rotate(144 12 12)" />
        <path d="M12 12 C 10.4 8.6 10.4 5.6 12 4.2 C 13.6 5.6 13.6 8.6 12 12" transform="rotate(216 12 12)" />
        <path d="M12 12 C 10.4 8.6 10.4 5.6 12 4.2 C 13.6 5.6 13.6 8.6 12 12" transform="rotate(288 12 12)" />
      </g>
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    </svg>
  );
}

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
      <PageWash background="radial-gradient(ellipse 50% 40% at 85% 90%, rgba(243, 228, 211, 0.6), rgba(243, 228, 211, 0) 70%)" />

      <Container className="relative z-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-14">
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

          <div className="stitch relative bg-background px-6 py-8 sm:px-10 sm:py-10">
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
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 items-center justify-center border border-rose-line/70 bg-blush/60 text-rose-deep"
                    >
                      <ReasonIcon name={reason.icon} />
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