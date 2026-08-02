import { test, expect, describe } from "bun:test";
import {
  getPriceRange,
  getFlowerTypes,
  getFlowerColors,
  formatLabel,
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