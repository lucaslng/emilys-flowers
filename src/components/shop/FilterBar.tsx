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
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-sans text-xs font-semibold uppercase tracking-wider text-[#8B7B7B]">
            Category:
          </span>
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => onCategoryChange(cat.value)}
              className={`rounded-lg px-3 py-1.5 font-sans text-sm font-medium transition-colors ${
                selectedCategory === cat.value
                  ? 'bg-[#D4A5A5] text-white'
                  : 'bg-[#FFFAFA] text-[#4A3B3B] hover:bg-[#F9E4E4]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Secondary Category Filter (e.g. flower color) */}
        {secondaryCategories && onSecondaryCategoryChange && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-sans text-xs font-semibold uppercase tracking-wider text-[#8B7B7B]">
              Color:
            </span>
            {secondaryCategories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => onSecondaryCategoryChange(cat.value)}
                className={`rounded-lg px-3 py-1.5 font-sans text-sm font-medium transition-colors ${
                  selectedSecondaryCategory === cat.value
                    ? 'bg-[#D4A5A5] text-white'
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
      <div className="flex items-center gap-2">
        <span className="font-sans text-xs font-semibold uppercase tracking-wider text-[#8B7B7B]">
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
        <span className="font-sans text-xs text-[#8B7B7B]">
          ${(selectedPriceRange[0] / 100).toFixed(0)}
        </span>
        <span className="font-sans text-xs text-[#8B7B7B]">—</span>
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
        <span className="font-sans text-xs text-[#8B7B7B]">
          ${(selectedPriceRange[1] / 100).toFixed(0)}
        </span>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <span className="font-sans text-xs font-semibold uppercase tracking-wider text-[#8B7B7B]">
          Sort:
        </span>
        <select
          value={selectedSort}
          onChange={(e) => onSortChange(e.target.value)}
          className="rounded-lg border border-[#F0E0E0] bg-[#FFFAFA] px-3 py-1.5 font-sans text-sm text-[#4A3B3B] outline-none transition-colors focus:border-[#D4A5A5]"
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
