import type { Metadata } from 'next';
import Container from '@/components/ui/Container';
import StarMotif from '@/components/ui/StarMotif';

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Shipping answers for Emily\u2019s Flowers - where online orders are delivered and how to arrange international delivery.',
  alternates: {
    canonical: '/faq',
  },
};

export default function FaqPage() {
  return (
    <div className="relative isolate overflow-hidden py-16 sm:py-24">
      {/* Warm wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 50% 15%, rgba(249, 228, 228, 0.45), rgba(254, 250, 245, 0) 70%)',
        }}
      />

      <Container className="relative z-10">
        <div className="mx-auto max-w-3xl">
          <div className="relative">
            <StarMotif size={48} className="absolute -left-8 -top-6 text-rose opacity-70" />
            <p className="font-hand text-3xl leading-none text-rose-deep">
              good to know ♡
            </p>
            <h1 className="mt-3 font-sans text-3xl font-bold uppercase tracking-[0.06em] text-foreground sm:text-4xl">
              FAQ
            </h1>
            <p className="mt-2 font-sans text-sm text-muted">Common answers</p>
          </div>

          <div className="mt-10 stitch relative bg-background px-6 py-8 sm:px-10 sm:py-10">
            <h2 className="font-sans text-xl font-bold uppercase tracking-[0.1em] text-foreground sm:text-2xl">
              Shipping Locations
            </h2>
            <div className="gift-divider mt-4" />
            <p className="mt-5 font-sans text-base leading-relaxed text-muted">
              Unfortunately, we currently only ship online orders to Canada.
              However, you can dm us on instagram (@emilysflowers_), and we
              will ship to international locations for a higher delivery fee.
            </p>
            <p className="mt-6 font-hand text-2xl leading-none text-rose-deep">
              message us and we&rsquo;ll work it out ♡
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}