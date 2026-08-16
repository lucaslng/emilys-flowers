import type { Metadata } from 'next';
import Container from '@/components/ui/Container';

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
    <Container className="py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-serif text-3xl font-bold text-[#4A3B3B] sm:text-4xl">
          FAQ
        </h1>
        <p className="mt-2 font-sans text-sm text-[#7A6868]">Common answers</p>
        <div className="mt-8 plaque-card px-6 py-8 sm:px-10 sm:py-12">
          <h2 className="font-serif text-2xl font-bold text-[#4A3B3B] sm:text-3xl">
            Shipping Locations
          </h2>
          <div className="mt-5 h-px w-16 bg-[#D4A5A5]" aria-hidden="true" />
          <p className="mt-6 font-sans text-base leading-relaxed text-[#7A6868]">
            Unfortunately, we currently only ship online orders to Canada. However,
            you can dm us on instagram (@emilysflowers_), and we will ship to
            international locations for a higher delivery fee.
          </p>
        </div>
      </div>
    </Container>
  );
}