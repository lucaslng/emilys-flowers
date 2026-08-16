import Link from 'next/link';
import Container from '@/components/ui/Container';

type FooterLink = { label: string; href: string; external?: boolean };

type FooterGroup = { title: string; links: FooterLink[] };

const footerLinks: FooterGroup[] = [
  {
    title: 'Shop',
    links: [
      { label: 'Individual Flowers', href: '/flowers' },
      { label: 'Bouquet Collections', href: '/bouquets' },
      { label: 'Featured', href: '/' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Contact Us', href: '#' },
      { label: 'Shipping Info', href: '#' },
      { label: 'Returns', href: '#' },
      { label: 'FAQ', href: '#' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '#' },
      { label: 'Our Story', href: '#' },
      { label: 'Blog', href: '#' },
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
  return (
    <footer className="relative isolate overflow-hidden border-t border-[#F0E0E0] bg-[#FFF5F5]">
      {/* Ambient falling petals — behind all footer content */}
      <span className="petal text-[#B16E6E] text-lg"  style={{ left: '6%',  animationDuration: '11s', animationDelay: '0s' }}   aria-hidden="true">❀</span>
      <span className="petal text-[#B16E6E] text-xl"  style={{ left: '22%', animationDuration: '14s', animationDelay: '2.5s' }} aria-hidden="true">✿</span>
      <span className="petal text-[#B16E6E] text-sm"  style={{ left: '38%', animationDuration: '9s',  animationDelay: '4s' }}   aria-hidden="true">❀</span>
      <span className="petal text-[#B16E6E] text-2xl" style={{ left: '52%', animationDuration: '13s', animationDelay: '1s' }}  aria-hidden="true">✿</span>
      <span className="petal text-[#B16E6E] text-base" style={{ left: '66%', animationDuration: '10s', animationDelay: '5.5s' }} aria-hidden="true">❀</span>
      <span className="petal text-[#B16E6E] text-lg"  style={{ left: '78%', animationDuration: '12s', animationDelay: '3s' }}  aria-hidden="true">✿</span>
      <span className="petal text-[#B16E6E] text-sm"  style={{ left: '90%', animationDuration: '15s', animationDelay: '6s' }}  aria-hidden="true">❀</span>

      <div className="relative z-10">
        {/* Links */}
        <Container className="py-12">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {/* Brand */}
            <div>
              <Link
                href="/"
                className="font-serif text-xl font-bold text-[#4A3B3B]"
              >
                Emily&#39;s Flowers
              </Link>
              <p className="mt-3 font-sans text-sm text-[#7A6868] leading-relaxed">
                Handcrafted ribbon flowers and bouquets made with love and
                attention to detail. Each piece is a timeless work of art.
              </p>
            </div>

            {/* Link Columns */}
            {footerLinks.map((group) => (
              <div key={group.title}>
                <h3 className="mb-4 font-sans text-sm font-semibold uppercase tracking-wider text-[#4A3B3B]">
                  {group.title}
                </h3>
                <ul className="space-y-3">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        {...(link.external
                          ? { target: '_blank', rel: 'noopener noreferrer' }
                          : {})}
                        className="font-sans text-sm text-[#7A6868] transition-colors hover:text-[#9E5E5E]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>

        {/* Bottom Bar */}
        <div className="border-t border-[#F0E0E0]">
          <Container className="flex items-center justify-center py-6">
            <span className="font-sans text-xs text-[#7A6868]">Handcrafted with &hearts;</span>
          </Container>
        </div>
      </div>
    </footer>
  );
}