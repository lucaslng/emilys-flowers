import React from 'react';
import Container from '@/components/ui/Container';
import Reveal from '@/components/ui/Reveal';

const reasons = [
  {
    title: 'Cut and Shaped by Hand',
    description:
      'Every bloom is cut, folded, and assembled by a single maker — not a production line. The small irregularities are the point: they are how you know a person made it.',
  },
  {
    title: 'Made to Keep',
    description:
      'Ribbon and wire hold their shape long after fresh flowers would fade. A spot out of direct sun and the occasional gentle dust is all they ask.',
  },
  {
    title: 'Made to Your Palette',
    description:
      'Custom color, scale, and arrangement requests are welcome for weddings, interiors, and gifts. Tell us what you have in mind and we will tell you honestly what is possible.',
  },
];

export default function WhyChooseUs() {
  return (
    <section className="bg-[#FFF5F5] pt-20 pb-24 sm:pt-28 sm:pb-32">
      <Container>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          {/* Editorial intro — left column */}
          <Reveal className="lg:pt-2">
            <h2 className="font-serif text-3xl font-bold text-[#4A3B3B] sm:text-4xl">
              Why Emily&rsquo;s Flowers
            </h2>
            <p className="mt-4 max-w-sm font-sans text-base leading-relaxed text-[#8B7B7B]">
              Three standards behind every arrangement that leaves our studio.
            </p>
            {/* Short hairline rule — restrained replacement for the squiggle */}
            <div className="mt-6 h-px w-16 bg-[#D4A5A5]" aria-hidden="true" />
            <p className="mt-8 max-w-sm font-sans text-sm leading-relaxed text-[#8B7B7B]">
              Made in small batches, then wrapped in tissue and tied with ribbon.
            </p>
          </Reveal>

          {/* Specimen list — right column, framed by hairlines */}
          <Reveal
            stagger
            className="border-t border-[#F0E0E0] lg:border-t-0 lg:border-l lg:pl-16"
          >
            {reasons.map((reason, i) => (
              <div
                key={reason.title}
                className="group grid grid-cols-[auto_1fr] items-start gap-x-6 border-b border-[#F0E0E0] py-8 transition-colors duration-300 hover:border-[#D4A5A5] sm:gap-x-8 sm:py-10"
              >
                <span
                  aria-hidden="true"
                  className="font-serif text-2xl leading-none tabular-nums text-[#D4A5A5] sm:text-3xl"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="plaque-name font-serif text-xl font-semibold text-[#4A3B3B] sm:text-2xl">
                    {reason.title}
                  </h3>
                  <p className="mt-2 font-sans text-sm leading-relaxed text-[#8B7B7B] sm:text-base">
                    {reason.description}
                  </p>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </Container>
    </section>
  );
}