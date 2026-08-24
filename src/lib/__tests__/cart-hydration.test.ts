import { test, expect, describe } from "bun:test";
import { sanitizeStoredCart } from "@/lib/cart-context";
import type { CartItem, Product } from "@/types";

const rose: Product = {
  id: "ribbon-rose",
  slug: "ribbon-rose",
  name: "Ribbon Rose",
  description: "A rose",
  price: 2499,
  images: ["/placeholders/flower.svg"],
  category: "flower",
  tags: ["rose"],
  inStock: true,
};

const peony: Product = {
  id: "ribbon-peony",
  slug: "ribbon-peony",
  name: "Ribbon Peony",
  description: "A peony",
  price: 2999,
  images: ["/placeholders/flower.svg"],
  category: "flower",
  tags: ["peony"],
  inStock: true,
};

const validCart: CartItem[] = [
  { product: rose, quantity: 2 },
  { product: peony, quantity: 1 },
];

describe("sanitizeStoredCart", () => {
  test("non-array inputs -> []", () => {
    expect(sanitizeStoredCart(null)).toEqual([]);
    expect(sanitizeStoredCart(undefined)).toEqual([]);
    expect(sanitizeStoredCart('"garbage"')).toEqual([]);
    expect(sanitizeStoredCart({ items: validCart })).toEqual([]);
    expect(sanitizeStoredCart(42)).toEqual([]);
  });

  test("empty array -> []", () => {
    expect(sanitizeStoredCart([])).toEqual([]);
  });

  test("keeps a cart written by the app", () => {
    expect(sanitizeStoredCart(JSON.parse(JSON.stringify(validCart)))).toEqual(validCart);
  });

  test("drops items with non-integer, zero, or negative quantities", () => {
    const cases = [0, -1, 1.5, NaN, Infinity, "2"];
    for (const quantity of cases) {
      const out = sanitizeStoredCart([{ product: rose, quantity }]);
      expect(out).toEqual([]);
    }
  });

  test("drops items whose product is missing or wrong-typed", () => {
    const cases: unknown[] = [
      { quantity: 1 },
      { quantity: 1, product: null },
      { quantity: 1, product: "rose" },
      { quantity: 1, product: { ...rose, name: 42 } },
      { quantity: 1, product: { ...rose, price: "24.99" } },
      { quantity: 1, product: { ...rose, price: -5 } },
      { quantity: 1, product: { ...rose, price: 24.99 } },
      { quantity: 1, product: { ...rose, images: undefined } },
      { quantity: 1, product: { ...rose, category: "shrub" } },
      { quantity: 1, product: { ...rose, id: "" } },
      { quantity: 1, product: { ...rose, inStock: "yes" } },
    ];
    for (const item of cases) {
      expect(sanitizeStoredCart([item])).toEqual([]);
    }
  });

  test("keeps only valid items when mixed with garbage", () => {
    const out = sanitizeStoredCart([
      { product: rose, quantity: 2 },
      { product: { ...rose, price: undefined }, quantity: 1 },
      { product: { ...rose, category: "shrub" }, quantity: 1 },
      { product: rose, quantity: 0 },
    ]);
    expect(out).toEqual([{ product: rose, quantity: 2 }]);
  });

  // The server rejects any line above MAX_LINE_ITEM_QUANTITY at pay time, so
  // an oversized stored quantity is clamped (item preserved) instead of
  // surviving until checkout fails with "Invalid line item".
  test("clamps quantities above the per-line cap, preserving the item", () => {
    const out = sanitizeStoredCart([
      { product: rose, quantity: 500 },
      { product: peony, quantity: 99 },
    ]);
    expect(out).toEqual([
      { product: rose, quantity: 99 },
      { product: peony, quantity: 99 },
    ]);
  });
});
