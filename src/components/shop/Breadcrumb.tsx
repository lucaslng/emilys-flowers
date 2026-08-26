import Link from 'next/link';

export interface Crumb {
  name: string;
  href?: string;
}

interface BreadcrumbProps {
  items: Crumb[];
  className?: string;
}

/**
 * Breadcrumb — quiet Martian-Mono-voiced trail mirroring the page's
 * BreadcrumbList JSON-LD. Intermediate crumbs are crawlable links; the
 * final crumb marks the current location. Separators are decorative.
 */
export default function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${index}-${item.name}`} className="flex items-center gap-2">
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className="-rotate-6 font-sans text-[0.65rem] leading-none text-rose-line select-none"
                >
                  /
                </span>
              )}
              {isLast || !item.href ? (
                <span
                  aria-current="page"
                  className="block max-w-[13rem] truncate px-0.5 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-foreground sm:max-w-xs"
                >
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="-my-2 px-0.5 py-2 font-sans text-xs font-medium uppercase tracking-[0.18em] text-muted transition-colors hover:text-rose-deep"
                >
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
