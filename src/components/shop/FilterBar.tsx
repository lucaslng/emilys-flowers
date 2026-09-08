'use client';

import {
  PRICE_BUCKET_OPTIONS,
  type FilterOption,
  type PriceBucket,
} from '@/lib/product-utils';

interface FilterBarProps {
  categories: FilterOption[];
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  sortOptions: FilterOption[];
  selectedSort: string;
  onSortChange: (value: string) => void;
  selectedPrice: PriceBucket;
  onPriceChange: (value: PriceBucket) => void;
  priceOptions?: FilterOption[];
  /** Optional secondary category group (e.g. flower color) below the primary row. */
  secondaryCategories?: FilterOption[];
  selectedSecondaryCategory?: string;
  onSecondaryCategoryChange?: (value: string) => void;
}

function GiftTag({
  label,
  pressed,
  onPress,
}: {
  label: string;
  pressed: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={pressed}
      className={`gift-card relative inline-flex items-center whitespace-nowrap py-1 pl-6 pr-2.5 font-sans text-[11px] font-medium odd:-rotate-1 even:rotate-1 ${
        pressed
          ? 'is-emphasized bg-blush text-foreground'
          : 'bg-background text-foreground hover:bg-blush'
      }`}
    >
      <span
        aria-hidden="true"
        className="absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full border border-rose-line bg-surface"
      />
      <span
        aria-hidden="true"
        className="absolute left-[13px] top-1/2 h-px w-2 -translate-y-1/2 rotate-45 bg-rose-line"
      />
      {label}
    </button>
  );
}

export default function FilterBar({
  categories,
  selectedCategory,
  onCategoryChange,
  sortOptions,
  selectedSort,
  onSortChange,
  selectedPrice,
  onPriceChange,
  priceOptions = PRICE_BUCKET_OPTIONS,
  secondaryCategories,
  selectedSecondaryCategory,
  onSecondaryCategoryChange,
}: FilterBarProps) {
  const showCategories = categories.length > 1;
  const showSecondary =
    !!secondaryCategories &&
    !!onSecondaryCategoryChange &&
    secondaryCategories.length > 1;

  return (
    <div className="stitch relative flex flex-col gap-3 bg-surface px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:gap-4">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
        <p className="whitespace-nowrap font-hand text-xl leading-none text-rose-deep">
          filter by…
        </p>

        {showCategories && (
          <div
            role="group"
            aria-label="Filter by category"
            className="flex flex-wrap items-center gap-1.5"
          >
            {categories.map((cat) => (
              <GiftTag
                key={cat.value}
                label={cat.label}
                pressed={selectedCategory === cat.value}
                onPress={() => onCategoryChange(cat.value)}
              />
            ))}
          </div>
        )}

        {showSecondary && (
          <div
            role="group"
            aria-label="Filter by color"
            className="flex flex-wrap items-center gap-1.5"
          >
            {secondaryCategories!.map((cat) => (
              <GiftTag
                key={cat.value}
                label={cat.label}
                pressed={selectedSecondaryCategory === cat.value}
                onPress={() => onSecondaryCategoryChange!(cat.value)}
              />
            ))}
          </div>
        )}

        <div
          role="group"
          aria-label="Filter by price"
          className="flex flex-wrap items-center gap-1.5"
        >
          {priceOptions.map((opt) => (
            <GiftTag
              key={opt.value}
              label={opt.label}
              pressed={selectedPrice === opt.value}
              onPress={() => onPriceChange(opt.value as PriceBucket)}
            />
          ))}
        </div>
      </div>

      <div
        role="group"
        aria-label="Sort products"
        className="flex shrink-0 items-center lg:ml-auto"
      >
          <span className="relative inline-block -rotate-1">
            <select
              value={selectedSort}
              onChange={(e) => onSortChange(e.target.value)}
              aria-label="Sort products"
              className="stitch appearance-none whitespace-nowrap bg-background py-1.5 pl-3 pr-8 font-sans text-[11px] text-foreground shadow-[0_2px_8px_-4px_rgba(212,165,165,0.6)] transition-colors hover:bg-blush focus:border-rose-line"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-[-4px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-dashed border-[#E4C9B8] bg-surface"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-[22px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-dashed border-[#E4C9B8] bg-surface"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-sans text-xs text-rose-deep"
            >
              ⌄
            </span>
          </span>
        </div>
    </div>
  );
}
