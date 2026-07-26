import { test, expect, describe } from "bun:test";
import {
  products,
  getProductById,
  getFeaturedProducts,
  getProductsByCategory,
} from "@/lib/products";

describe("products data", () => {
  test("products array has 16 items (5 flowers + 11 bouquets)", () => {
    expect(products).toHaveLength(16);
  });

  test("contains 5 flowers", () => {
    const flowers = products.filter((p) => p.category === "flower");
    expect(flowers).toHaveLength(5);
  });

  test("contains 11 bouquets", () => {
    const bouquets = products.filter((p) => p.category === "bouquet");
    expect(bouquets).toHaveLength(11);
  });

  test("all ids are unique", () => {
    const ids = products.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test("all prices are positive integers (cents)", () => {
    for (const product of products) {
      expect(Number.isInteger(product.price)).toBe(true);
      expect(product.price).toBeGreaterThan(0);
    }
  });

  test("all products are inStock", () => {
    for (const product of products) {
      expect(product.inStock).toBe(true);
    }
  });
});

describe("getProductById", () => {
  test("returns the Ribbon Rose product for 'ribbon-rose'", () => {
    const rose = getProductById("ribbon-rose");
    expect(rose).toBeDefined();
    expect(rose!.name).toBe("Ribbon Rose");
    expect(rose!.price).toBe(2499);
    expect(rose!.category).toBe("flower");
  });

  test("returns undefined for nonexistent id", () => {
    expect(getProductById("nonexistent")).toBeUndefined();
  });
});

describe("getFeaturedProducts", () => {
  test("returns exactly 3 products", () => {
    expect(getFeaturedProducts()).toHaveLength(3);
  });

  test("returns blush-romance, lavender-dreams, spring-meadow", () => {
    const featured = getFeaturedProducts();
    const ids = featured.map((p) => p.id).sort();
    expect(ids).toEqual(["blush-romance", "lavender-dreams", "spring-meadow"]);
  });

  test("all featured products are bouquets", () => {
    for (const product of getFeaturedProducts()) {
      expect(product.category).toBe("bouquet");
    }
  });
});

describe("getProductsByCategory", () => {
  test("returns 5 flowers", () => {
    expect(getProductsByCategory("flower")).toHaveLength(5);
  });

  test("returns 11 bouquets", () => {
    expect(getProductsByCategory("bouquet")).toHaveLength(11);
  });

  test("all returned products have the requested category", () => {
    for (const product of getProductsByCategory("flower")) {
      expect(product.category).toBe("flower");
    }
    for (const product of getProductsByCategory("bouquet")) {
      expect(product.category).toBe("bouquet");
    }
  });
});
