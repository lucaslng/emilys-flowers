import Link from 'next/link';
import Container from '@/components/ui/Container';
import StarMotif from '@/components/ui/StarMotif';

type FooterLink = { label: string; href: string; external?: boolean };

type FooterGroup = { title: string; links: FooterLink[] };

const footerLinks: FooterGroup[] = [
  {
    title: 'Shop',
    links: [
      { label: 'Individual Flowers', href: '/flowers' },
      { label: 'Bouquet Collections', href: '/bouquets' },
      { label: 'Featured', href: '/' },
      { label: 'About Us', href: '/#why-emilys-flowers' },
      { label: 'FAQ', href: '/faq' },
    ],
  },
  {
    title: 'Contact',
    links: [
      { label: 'contact@emilysflowers.ca', href: 'mailto:contact@emilysflowers.ca' },
      { label: 'Instagram: @emilysflowers_', href: 'https://instagram.com/emilysflowers_', external: true },
      { label: 'TikTok: @emilyysflowers', href: 'https://www.tiktok.com/@emilyysflowers', external: true },
    ],
  },
];

/**
 * Footer — "the maker's card", taped to the bottom of the page. A full-width
 * washi-tape strip straddles the top seam (the tape that attaches the card to
 * the page), and a frosted wrapping-paper grid makes the card read as a
 * different paper from the page — a clear boundary at any viewport. The brand
 * block sits on a tilted washi-taped card at the left, the two link groups are
 * overlapping note cards at the right, and the bottom bar carries a
 * handwritten sign-off.
 */
export default function Footer() {
  return (
    <footer className="relative isolate border-t border-border bg-surface">
      {/* Washi tape attaching the card to the page — straddles the top seam */}
      <div
        aria-hidden="true"
        className="washi absolute inset-x-0 -top-2 z-20 h-4 -rotate-1"
      />

      <div className="relative isolate overflow-hidden">
        {/* Frosted wrapping-paper texture — the card reads as a different paper */}
        <div
          aria-hidden="true"
          className="wrapping-grid pointer-events-none absolute inset-0 opacity-60"
        />

        {/* Ambient falling petals — behind all footer content */}
        <span className="petal text-rose-line text-lg"  style={{ left: '6%',  animationDuration: '11s', animationDelay: '0s' }}   aria-hidden="true">❀</span>
        <span className="petal text-rose-line text-xl"  style={{ left: '22%', animationDuration: '14s', animationDelay: '2.5s' }} aria-hidden="true">✿</span>
        <span className="petal text-rose-line text-sm"  style={{ left: '38%', animationDuration: '9s',  animationDelay: '4s' }}   aria-hidden="true">❀</span>
        <span className="petal text-rose-line text-2xl" style={{ left: '52%', animationDuration: '13s', animationDelay: '1s' }}  aria-hidden="true">✿</span>
        <span className="petal text-rose-line text-base" style={{ left: '66%', animationDuration: '10s', animationDelay: '5.5s' }} aria-hidden="true">❀</span>
        <span className="petal text-rose-line text-lg"  style={{ left: '78%', animationDuration: '12s', animationDelay: '3s' }}  aria-hidden="true">✿</span>
        <span className="petal text-rose-line text-sm"  style={{ left: '90%', animationDuration: '15s', animationDelay: '6s' }}  aria-hidden="true">❀</span>

        <div className="relative z-10">
          <Container className="py-10 sm:py-16">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8">
            {/* Brand — tilted card with a washi-tape corner and star motif */}
            <div className="relative">
              <div className="relative -rotate-1 border border-border bg-background p-5 sm:p-8">
                {/* Washi tape across the top-left corner */}
                <span aria-hidden="true" className="washi absolute -top-3 left-6 h-6 w-24 -rotate-3" />
                <Link
                  href="/"
                  className="font-sans text-xl font-bold uppercase tracking-[0.16em] text-foreground transition-colors hover:text-rose-deep"
                >
                  Emily&#39;s Flowers
                </Link>
                <p className="mt-3 max-w-xs font-sans text-sm leading-relaxed text-muted">
                  Handcrafted ribbon flowers and bouquets, folded petal by
                  petal.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="h-px w-12 bg-rose-line/60" aria-hidden="true" />
                  <span className="flex items-center gap-1">
                    <span className="font-hand text-2xl leading-none text-rose-deep">
                      made with
                    </span>
                    {/* Hand-drawn heart outline — boils like ink settling */}
                    <svg
                      aria-hidden="true"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="line-boil-fine text-rose-deep"
                    >
                      <path
                        d="M12 20 C 8.5 16.5 4.5 13.5 4.5 9.5 C 4.5 6.5 6.5 4.5 9 4.5 C 10.5 4.5 11.5 5.5 12 7 C 12.5 5.5 13.5 4.5 15 4.5 C 17.5 4.5 19.5 6.5 19.5 9.5 C 19.5 13.5 15.5 16.5 12 20 Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
                {/* Origami star — the geometric counterpoint */}
                <StarMotif
                  size={56}
                  className="animate-star absolute -right-3 -top-3 text-rose opacity-70"
                />
              </div>
            </div>

            {/* Link groups — two overlapping note cards */}
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-end sm:gap-6">
              {footerLinks.map((group, i) => (
                <div
                  key={group.title}
                  className={`relative w-full border border-border bg-background p-4 sm:p-5 ${
                    i === 0 ? 'rotate-1 sm:w-56' : '-rotate-1 sm:mt-6 sm:w-64'
                  }`}
                >
                  <h3 className="mb-3 font-sans text-xs font-semibold uppercase tracking-[0.22em] text-rose-deep">
                    {group.title}
                  </h3>
                  <ul className="space-y-2.5">
                    {group.links.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          {...(link.external
                            ? { target: '_blank', rel: 'noopener noreferrer' }
                            : {})}
                          className={`font-sans text-muted transition-colors hover:text-rose-deep ${
                            link.href.startsWith('mailto:')
                              ? 'whitespace-nowrap text-xs'
                              : 'text-sm'
                          }`}
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </Container>

        {/* Bottom Bar — handwritten sign-off */}
        <div className="border-t border-border">
          <Container className="flex items-center justify-center gap-3 py-4 sm:py-6">
            <span aria-hidden="true" className="text-xs text-rose-line">❀</span>
            <span className="font-hand text-xl leading-none text-rose-deep">
              handcrafted with love
            </span>
            <span aria-hidden="true" className="text-xs text-rose-line">❀</span>
          </Container>
        </div>
        </div>
      </div>
    </footer>
  );
}