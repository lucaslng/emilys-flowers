import Link from 'next/link';
import Container from '@/components/ui/Container';
import StarMotif from '@/components/ui/StarMotif';
import FlowerMotif from '@/components/ui/FlowerMotif';
import HeartMotif from '@/components/ui/HeartMotif';
import { isFlowersEnabled, isFlowersHref } from '@/lib/flagship-flag';

type FooterLink = { label: string; href: string; external?: boolean };

type FooterGroup = { title: string; links: FooterLink[] };

const footerLinks: FooterGroup[] = [
  {
    title: 'Shop',
    links: [
      { label: 'Individual Flowers', href: '/flowers' },
      { label: 'Bouquet Collections', href: '/bouquets' },
      { label: 'About Us', href: '/#why-emilys-flowers' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
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

export default function Footer() {
  const showFlowers = isFlowersEnabled();
  const visibleFooterLinks = footerLinks.map((group) => ({
    ...group,
    links: group.links.filter(
      (link) => showFlowers || !isFlowersHref(link.href)
    ),
  }));
  return (
    <footer className="relative isolate border-t border-border bg-surface">
      <div
        aria-hidden="true"
        className="washi absolute inset-x-0 -top-2 z-20 h-4 -rotate-1"
      />

      <div className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="wrapping-grid pointer-events-none absolute inset-0 opacity-60"
        />

        <FlowerMotif size={18} className="petal text-rose-line" style={{ left: '6%', animationDuration: '11s', animationDelay: '0s' }} />
        <FlowerMotif size={22} className="petal text-rose-line" style={{ left: '22%', animationDuration: '14s', animationDelay: '2.5s' }} />
        <FlowerMotif size={14} className="petal text-rose-line" style={{ left: '38%', animationDuration: '9s', animationDelay: '4s' }} />
        <FlowerMotif size={26} className="petal text-rose-line" style={{ left: '52%', animationDuration: '13s', animationDelay: '1s' }} />
        <FlowerMotif size={16} className="petal text-rose-line" style={{ left: '66%', animationDuration: '10s', animationDelay: '5.5s' }} />
        <FlowerMotif size={18} className="petal text-rose-line" style={{ left: '78%', animationDuration: '12s', animationDelay: '3s' }} />
        <FlowerMotif size={14} className="petal text-rose-line" style={{ left: '90%', animationDuration: '15s', animationDelay: '6s' }} />

        <div className="relative z-10">
          <Container className="py-10 sm:py-16">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8">
            <div className="relative">
              <div className="relative -rotate-1 border border-border bg-background p-5 sm:p-8">
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
                    <HeartMotif size={18} className="line-boil-fine text-rose-deep" />
                  </span>
                </div>
                <StarMotif
                  size={56}
                  className="animate-star absolute -right-3 -top-3 text-rose opacity-70"
                />
              </div>
            </div>

            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-end sm:gap-6">
              {visibleFooterLinks.map((group, i) => (
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

        <div className="border-t border-border">
          <Container className="flex items-center justify-center gap-3 py-4 sm:py-6">
            <StarMotif size={12} className="text-rose-line" />
            <span className="font-hand text-xl leading-none text-rose-deep">
              handcrafted with love
            </span>
            <StarMotif size={12} className="text-rose-line" />
          </Container>
        </div>
        </div>
      </div>
    </footer>
  );
}