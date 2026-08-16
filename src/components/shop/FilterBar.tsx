'use client';

interface FilterBarProps {
  categories: { label: string; value: string }[];
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  sortOptions: { label: string; value: string }[];
  selectedSort: string;
  onSortChange: (value: string) => void;
  priceRange: [number, number];
  selectedPriceRange: [number, number];
  onPriceRangeChange: (range: [number, number]) => void;
  /** Optional secondary category group (e.g. flower color) shown as a second
   *  row of pills below the primary category row. */
  secondaryCategories?: { label: string; value: string }[];
  selectedSecondaryCategory?: string;
  onSecondaryCategoryChange?: (value: string) => void;
}

/**
 * FilterBar — the "catalogue index". A stitched index card where filters
 * read as stamped tabs: category + color pills, price sliders, and a sort
 * select. Sharp corners and warm stamps — the geometric voice.
 */
export default function FilterBar({
  categories,
  selectedCategory,
  onCategoryChange,
  sortOptions,
  selectedSort,
  onSortChange,
  priceRange,
  selectedPriceRange,
  onPriceRangeChange,
  secondaryCategories,
  selectedSecondaryCategory,
  onSecondaryCategoryChange,
}: FilterBarProps) {
  const pillBase =
    'rounded-none px-3 py-1.5 font-sans text-xs font-medium uppercase tracking-[0.1em] transition-colors';
  const pillActive = 'bg-rose-deep text-white';
  const pillIdle =
    'bg-background text-foreground hover:bg-blush';

  return (
    <div className="stitch relative flex flex-col gap-5 bg-surface p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
      {/* Category Filters (primary + optional secondary) */}
      <div className="flex flex-col gap-3">
        <div
          role="group"
          aria-label="Filter by category"
          className="flex flex-wrap items-center gap-2"
        >
          <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-deep">
            Category
          </span>
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => onCategoryChange(cat.value)}
              aria-pressed={selectedCategory === cat.value}
              className={`${pillBase} ${
                selectedCategory === cat.value ? pillActive : pillIdle
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Secondary Category Filter (e.g. flower color) */}
        {secondaryCategories && onSecondaryCategoryChange && (
          <div
            role="group"
            aria-label="Filter by color"
            className="flex flex-wrap items-center gap-2"
          >
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-deep">
              Color
            </span>
            {secondaryCategories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => onSecondaryCategoryChange(cat.value)}
                aria-pressed={selectedSecondaryCategory === cat.value}
                className={`${pillBase} ${
                  selectedSecondaryCategory === cat.value ? pillActive : pillIdle
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Price Range */}
      <div
        role="group"
        aria-label="Filter by price"
        className="flex flex-wrap items-center gap-2"
      >
        <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-deep">
          Price
        </span>
        <input
          type="range"
          min={priceRange[0]}
          max={priceRange[1]}
          step={500}
          value={selectedPriceRange[0]}
          onChange={(e) =>
            onPriceRangeChange([
              parseInt(e.target.value),
              selectedPriceRange[1],
            ])
          }
          className="h-2 w-20 cursor-pointer appearance-none rounded-none bg-border accent-rose"
          aria-label="Minimum price"
        />
        <span className="font-sans text-xs text-muted">
          ${(selectedPriceRange[0] / 100).toFixed(0)}
        </span>
        <span className="font-sans text-xs text-muted">—</span>
        <input
          type="range"
          min={priceRange[0]}
          max={priceRange[1]}
          step={500}
          value={selectedPriceRange[1]}
          onChange={(e) =>
            onPriceRangeChange([
              selectedPriceRange[0],
              parseInt(e.target.value),
            ])
          }
          className="h-2 w-20 cursor-pointer appearance-none rounded-none bg-border accent-rose"
          aria-label="Maximum price"
        />
        <span className="font-sans text-xs text-muted">
          ${(selectedPriceRange[1] / 100).toFixed(0)}
        </span>
      </div>

      {/* Sort */}
      <div
        role="group"
        aria-label="Sort products"
        className="flex items-center gap-2"
      >
        <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-deep">
          Sort
        </span>
        <select
          value={selectedSort}
          onChange={(e) => onSortChange(e.target.value)}
          aria-label="Sort products"
          className="rounded-none border border-border bg-background px-3 py-1.5 font-sans text-xs text-foreground transition-colors focus:border-rose-line"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}