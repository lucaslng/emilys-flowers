import { test, expect, describe } from "bun:test";
import {
  getPriceRange,
  getFlowerTypes,
  getFlowerColors,
  formatLabel,
  matchesPriceBucket,
  PRICE_BUCKET_OPTIONS,
} from "@/lib/product-utils";
import type { Product } from "@/types";

function product(overrides: Partial<Product>): Product {
  return {
    id: "p",
    slug: "p",
    name: "P",
    description: "d",
    price: 1000,
    images: ["/placeholders/flower.svg"],
    category: "flower",
    tags: [],
    inStock: true,
    ...overrides,
  };
}

describe("getPriceRange", () => {
  test("returns [min, max] in cents", () => {
    const products = [
      product({ price: 2499 }),
      product({ price: 9999 }),
      product({ price: 399 }),
    ];
    expect(getPriceRange(products)).toEqual([399, 9999]);
  });

  test("returns [p, p] for a single product", () => {
    expect(getPriceRange([product({ price: 2499 })])).toEqual([2499, 2499]);
  });

  test("returns [0, 0] for an empty list (no Infinity)", () => {
    expect(getPriceRange([])).toEqual([0, 0]);
  });
});

describe("formatLabel", () => {
  test("humanizes snake_case", () => {
    expect(formatLabel("cream_white")).toBe("Cream White");
    expect(formatLabel("pink")).toBe("Pink");
  });
});

describe("getFlowerTypes", () => {
  test("returns unique types with 'All' first", () => {
    const products = [
      product({ flowerType: "rose" }),
      product({ flowerType: "rose" }),
      product({ flowerType: "tulip" }),
    ];
    expect(getFlowerTypes(products)).toEqual([
      { label: "All", value: "all" },
      { label: "Rose", value: "rose" },
      { label: "Tulip", value: "tulip" },
    ]);
  });

  test("returns only 'All' when no flower types present", () => {
    expect(getFlowerTypes([product({})])).toEqual([
      { label: "All", value: "all" },
    ]);
  });
});

describe("getFlowerColors", () => {
  test("returns unique colors with 'All' first, humanized", () => {
    const products = [
      product({ color: "cream_white" }),
      product({ color: "pink" }),
      product({ color: "cream_white" }),
    ];
    expect(getFlowerColors(products)).toEqual([
      { label: "All", value: "all" },
      { label: "Cream White", value: "cream_white" },
      { label: "Pink", value: "pink" },
    ]);
  });
});

describe("matchesPriceBucket", () => {
  test("all matches every price", () => {
    expect(matchesPriceBucket(100, "all")).toBe(true);
    expect(matchesPriceBucket(99999, "all")).toBe(true);
  });

  test("under-30 is strictly below 3000c", () => {
    expect(matchesPriceBucket(2999, "under-30")).toBe(true);
    expect(matchesPriceBucket(3000, "under-30")).toBe(false);
  });

  test("30-50 spans 3000c to 5000c inclusive", () => {
    expect(matchesPriceBucket(2999, "30-50")).toBe(false);
    expect(matchesPriceBucket(3000, "30-50")).toBe(true);
    expect(matchesPriceBucket(4200, "30-50")).toBe(true);
    expect(matchesPriceBucket(5000, "30-50")).toBe(true);
    expect(matchesPriceBucket(5001, "30-50")).toBe(false);
  });

  test("over-50 is strictly above 5000c", () => {
    expect(matchesPriceBucket(5000, "over-50")).toBe(false);
    expect(matchesPriceBucket(5001, "over-50")).toBe(true);
  });

  test("unknown bucket matches nothing", () => {
    expect(matchesPriceBucket(1000, "nope")).toBe(false);
  });
});

describe("PRICE_BUCKET_OPTIONS", () => {
  test("starts with All and covers the three buckets", () => {
    expect(PRICE_BUCKET_OPTIONS.map((o) => o.value)).toEqual([
      "all",
      "under-30",
      "30-50",
      "over-50",
    ]);
  });
});