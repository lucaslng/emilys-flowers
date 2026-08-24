'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import Container from '@/components/ui/Container';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/flowers', label: 'Flowers' },
  { href: '/bouquets', label: 'Bouquets' },
];

export default function Navbar({ showFlowers = true }: { showFlowers?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { getItemCount } = useCart();
  const itemCount = getItemCount();

  const visibleLinks = navLinks.filter(
    (link) => showFlowers || link.href !== '/flowers'
  );

  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  // Closing the menu always returns focus to the toggle (WCAG 2.4.3).
  const closeMenu = useCallback(() => {
    setMobileOpen(false);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      firstLinkRef.current?.focus();
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, closeMenu]);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[#E4C9B8]/70" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-px bg-[#E4C9B8]/40" />

      <span className="petal-nav text-rose-line text-xs"  style={{ left: '8%',  top: '12px', animationDuration: '9s',  animationDelay: '0s' }}   aria-hidden="true">❀</span>
      <span className="petal-nav text-rose-line text-sm"  style={{ left: '24%', top: '38px', animationDuration: '12s', animationDelay: '2.5s' }} aria-hidden="true">✿</span>
      <span className="petal-nav text-rose-line text-base" style={{ left: '42%', top: '20px', animationDuration: '10s', animationDelay: '4s' }}   aria-hidden="true">❀</span>
      <span className="petal-nav text-rose-line text-xs"  style={{ left: '56%', top: '34px', animationDuration: '13s', animationDelay: '1s' }}   aria-hidden="true">✿</span>
      <span className="petal-nav text-rose-line text-sm"  style={{ left: '68%', top: '16px', animationDuration: '11s', animationDelay: '5.5s' }} aria-hidden="true">❀</span>
      <span className="petal-nav text-rose-line text-xs"  style={{ left: '82%', top: '40px', animationDuration: '14s', animationDelay: '3s' }}   aria-hidden="true">✿</span>
      <span className="petal-nav text-rose-line text-sm"  style={{ left: '92%', top: '22px', animationDuration: '12s', animationDelay: '6s' }}   aria-hidden="true">❀</span>

      <Container>
        <div className="relative flex h-16 items-center justify-between">
          {/* Always a Link — the page h1 lives in each page's content. */}
          <Link
            href="/"
            className="group relative -rotate-1 rounded-none border border-rose-line/60 bg-surface px-3 py-1.5 font-sans text-sm font-bold uppercase tracking-[0.18em] text-foreground transition-colors hover:border-rose-line hover:text-rose-deep sm:text-base"
          >
            Emily&#39;s Flowers
            <span aria-hidden="true" className="absolute -right-2.5 -top-2.5 text-xs text-rose-deep transition-transform duration-300 group-hover:scale-125">
              ♡
            </span>
          </Link>

          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative font-sans text-sm font-medium uppercase tracking-[0.14em] text-foreground transition-colors hover:text-rose-deep after:absolute after:-bottom-1 after:left-1/2 after:h-px after:w-0 after:-translate-x-1/2 after:bg-rose-line after:transition-all after:duration-300 hover:after:w-full"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/cart"
              id="cart-icon"
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:border-rose-line hover:text-rose-deep"
              aria-label={
                itemCount > 0
                  ? `Shopping cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
                  : 'Shopping cart'
              }
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
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
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-deep text-xs font-bold text-white"
                >
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>

            <button
              ref={toggleRef}
              className="flex items-center text-foreground md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-menu"
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

        {mobileOpen && (
          <div
            id="mobile-nav-menu"
            className="border-t border-border pb-4 pt-2 md:hidden"
          >
            {visibleLinks.map((link, index) => (
              <Link
                key={link.href}
                ref={index === 0 ? firstLinkRef : undefined}
                href={link.href}
                className="block rounded-none px-3 py-2 font-sans text-sm font-medium uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-surface"
                onClick={closeMenu}
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