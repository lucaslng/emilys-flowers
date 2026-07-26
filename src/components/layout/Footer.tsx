import Link from 'next/link';
import Container from '@/components/ui/Container';

const footerLinks = [
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
];

export default function Footer() {
  return (
    <footer className="relative isolate overflow-hidden border-t border-[#F0E0E0] bg-[#FFF5F5]">
      {/* Ambient falling petals — behind all footer content */}
      <span className="petal petal-foot-1 text-[#D4A5A5] text-lg"  aria-hidden="true">❀</span>
      <span className="petal petal-foot-2 text-[#D4A5A5] text-xl"  aria-hidden="true">✿</span>
      <span className="petal petal-foot-3 text-[#D4A5A5] text-sm"  aria-hidden="true">❀</span>
      <span className="petal petal-foot-4 text-[#D4A5A5] text-2xl" aria-hidden="true">✿</span>
      <span className="petal petal-foot-5 text-[#D4A5A5] text-base" aria-hidden="true">❀</span>
      <span className="petal petal-foot-6 text-[#D4A5A5] text-lg"  aria-hidden="true">✿</span>
      <span className="petal petal-foot-7 text-[#D4A5A5] text-sm"  aria-hidden="true">❀</span>

      <div className="relative z-10">
        {/* Links */}
        <Container className="py-12">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div>
              <Link
                href="/"
                className="font-serif text-xl font-bold text-[#4A3B3B]"
              >
                Emily&#39;s Flowers
              </Link>
              <p className="mt-3 font-sans text-sm text-[#8B7B7B] leading-relaxed">
                Handcrafted ribbon flowers and bouquets made with love and
                attention to detail. Each piece is a timeless work of art.
              </p>
            </div>

            {/* Link Columns */}
            {footerLinks.map((group) => (
              <div key={group.title}>
                <h4 className="mb-4 font-sans text-sm font-semibold uppercase tracking-wider text-[#4A3B3B]">
                  {group.title}
                </h4>
                <ul className="space-y-3">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="font-sans text-sm text-[#8B7B7B] transition-colors hover:text-[#D4A5A5]"
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
            <span className="font-sans text-xs text-[#8B7B7B]">Handcrafted with &hearts;</span>
          </Container>
        </div>
      </div>
    </footer>
  );
}