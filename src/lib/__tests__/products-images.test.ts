import { test, expect, describe } from "bun:test";
import { products } from "@/lib/products";

describe("product image placeholders", () => {
  for (const product of products) {
    test(`${product.id} has a local placeholder image`, () => {
      expect(product.images.length).toBeGreaterThanOrEqual(1);
      const img = product.images[0];
      // Must be a local path, not a remote URL
      expect(img.startsWith("/")).toBe(true);
      expect(img.startsWith("http")).toBe(false);
      // Must match the per-category SVG
      if (product.category === "flower") {
        expect(img).toBe("/placeholders/flower.svg");
      } else {
        expect(img).toBe("/placeholders/bouquet.svg");
      }
    });
  }
});
