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
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[#F0E0E0] bg-[#FFF5F5] p-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Category Filters (primary + optional secondary) */}
      <div className="flex flex-col gap-2">
        <div
          role="group"
          aria-label="Filter by category"
          className="flex flex-wrap items-center gap-2"
        >
          <span className="font-sans text-xs font-semibold uppercase tracking-wider text-[#7A6868]">
            Category:
          </span>
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => onCategoryChange(cat.value)}
              aria-pressed={selectedCategory === cat.value}
              className={`rounded-lg px-3 py-1.5 font-sans text-sm font-medium transition-colors ${
                selectedCategory === cat.value
                  ? 'bg-[#9E5E5E] text-white'
                  : 'bg-[#FFFAFA] text-[#4A3B3B] hover:bg-[#F9E4E4]'
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
            <span className="font-sans text-xs font-semibold uppercase tracking-wider text-[#7A6868]">
              Color:
            </span>
            {secondaryCategories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => onSecondaryCategoryChange(cat.value)}
                aria-pressed={selectedSecondaryCategory === cat.value}
                className={`rounded-lg px-3 py-1.5 font-sans text-sm font-medium transition-colors ${
                  selectedSecondaryCategory === cat.value
                    ? 'bg-[#9E5E5E] text-white'
                    : 'bg-[#FFFAFA] text-[#4A3B3B] hover:bg-[#F9E4E4]'
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
        className="flex items-center gap-2"
      >
        <span className="font-sans text-xs font-semibold uppercase tracking-wider text-[#7A6868]">
          Price:
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
          className="h-2 w-20 cursor-pointer appearance-none rounded-lg bg-[#F0E0E0] accent-[#D4A5A5]"
          aria-label="Minimum price"
        />
        <span className="font-sans text-xs text-[#7A6868]">
          ${(selectedPriceRange[0] / 100).toFixed(0)}
        </span>
        <span className="font-sans text-xs text-[#7A6868]">—</span>
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
          className="h-2 w-20 cursor-pointer appearance-none rounded-lg bg-[#F0E0E0] accent-[#D4A5A5]"
          aria-label="Maximum price"
        />
        <span className="font-sans text-xs text-[#7A6868]">
          ${(selectedPriceRange[1] / 100).toFixed(0)}
        </span>
      </div>

      {/* Sort */}
      <div
        role="group"
        aria-label="Sort products"
        className="flex items-center gap-2"
      >
        <span className="font-sans text-xs font-semibold uppercase tracking-wider text-[#7A6868]">
          Sort:
        </span>
        <select
          value={selectedSort}
          onChange={(e) => onSortChange(e.target.value)}
          aria-label="Sort products"
          className="rounded-lg border border-[#F0E0E0] bg-[#FFFAFA] px-3 py-1.5 font-sans text-sm text-[#4A3B3B] transition-colors focus:border-[#B16E6E]"
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
