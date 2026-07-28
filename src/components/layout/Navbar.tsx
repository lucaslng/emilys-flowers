'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import Container from '@/components/ui/Container';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/flowers', label: 'Flowers' },
  { href: '/bouquets', label: 'Bouquets' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { getItemCount } = useCart();
  const itemCount = getItemCount();
  const pathname = usePathname();
  const isHome = pathname === '/';

  return (
    <nav className="sticky top-0 z-50 border-b border-[#F0E0E0] bg-[#FFFAFA]/95 backdrop-blur-sm">
      {/* Subtle ambient petals — behind all nav content (z -1), non-interactive */}
      <span className="petal-nav text-[#D4A5A5] text-xs"  style={{ left: '8%',  top: '12px', animationDuration: '9s',  animationDelay: '0s' }}   aria-hidden="true">❀</span>
      <span className="petal-nav text-[#D4A5A5] text-sm"  style={{ left: '24%', top: '38px', animationDuration: '12s', animationDelay: '2.5s' }} aria-hidden="true">✿</span>
      <span className="petal-nav text-[#D4A5A5] text-base" style={{ left: '42%', top: '20px', animationDuration: '10s', animationDelay: '4s' }}   aria-hidden="true">❀</span>
      <span className="petal-nav text-[#D4A5A5] text-xs"  style={{ left: '56%', top: '34px', animationDuration: '13s', animationDelay: '1s' }}   aria-hidden="true">✿</span>
      <span className="petal-nav text-[#D4A5A5] text-sm"  style={{ left: '68%', top: '16px', animationDuration: '11s', animationDelay: '5.5s' }} aria-hidden="true">❀</span>
      <span className="petal-nav text-[#D4A5A5] text-xs"  style={{ left: '82%', top: '40px', animationDuration: '14s', animationDelay: '3s' }}   aria-hidden="true">✿</span>
      <span className="petal-nav text-[#D4A5A5] text-sm"  style={{ left: '92%', top: '22px', animationDuration: '12s', animationDelay: '6s' }}   aria-hidden="true">❀</span>

      <Container>
        <div className="relative flex h-16 items-center justify-between">
          {/* Logo — H1 on homepage for SEO, Link on other pages */}
          {isHome ? (
            <h1 className="font-serif text-2xl font-bold tracking-tight text-[#4A3B3B]">
              <Link href="/">Emily&#39;s Flowers</Link>
            </h1>
          ) : (
            <Link
              href="/"
              className="font-serif text-2xl font-bold tracking-tight text-[#4A3B3B]"
            >
              Emily&#39;s Flowers
            </Link>
          )}

          {/* Desktop Nav — centered relative to the full row width */}
          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative font-sans text-sm font-medium text-[#4A3B3B] transition-colors hover:text-[#D4A5A5] after:absolute after:-bottom-1 after:left-1/2 after:h-px after:w-0 after:-translate-x-1/2 after:bg-[#D4A5A5] after:transition-all after:duration-300 hover:after:w-full"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Cart Icon & Mobile Toggle */}
          <div className="flex items-center gap-4">
            <Link
              href="/cart"
              id="cart-icon"
              className="relative flex items-center text-[#4A3B3B] transition-colors hover:text-[#D4A5A5]"
              aria-label="Shopping cart"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                />
              </svg>
              {itemCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#D4A5A5] text-xs font-bold text-white">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>

            {/* Mobile Hamburger */}
            <button
              className="flex items-center text-[#4A3B3B] md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="border-t border-[#F0E0E0] pb-4 pt-2 md:hidden">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-lg px-3 py-2 font-sans text-sm font-medium text-[#4A3B3B] transition-colors hover:bg-[#FFF5F5]"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </Container>
    </nav>
  );
}
