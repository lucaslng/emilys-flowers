import { test, expect, describe } from "bun:test";
import { toLineItems } from "@/lib/cart-context";
import type { CartItem, Product } from "@/types";

const rose: Product = {
  id: "ribbon-rose",
  slug: "ribbon-rose",
  name: "Ribbon Rose",
  description: "",
  price: 2499,
  images: [],
  category: "flower",
  tags: [],
  inStock: true,
};

const peony: Product = {
  id: "ribbon-peony",
  slug: "ribbon-peony",
  name: "Ribbon Peony",
  description: "",
  price: 2999,
  images: [],
  category: "flower",
  tags: [],
  inStock: true,
};

describe("toLineItems", () => {
  test("empty cart -> []", () => {
    expect(toLineItems([])).toEqual([]);
  });

  test("flattens a single CartItem to the LineItem shape", () => {
    const items: CartItem[] = [{ product: rose, quantity: 2 }];
    expect(toLineItems(items)).toEqual([
      {
        id: "ribbon-rose",
        name: "Ribbon Rose",
        price: 2499,
        quantity: 2,
        category: "flower",
      },
    ]);
  });

  test("flattens multiple items preserving order", () => {
    const items: CartItem[] = [
      { product: rose, quantity: 1 },
      { product: peony, quantity: 3 },
    ];
    expect(toLineItems(items)).toEqual([
      {
        id: "ribbon-rose",
        name: "Ribbon Rose",
        price: 2499,
        quantity: 1,
        category: "flower",
      },
      {
        id: "ribbon-peony",
        name: "Ribbon Peony",
        price: 2999,
        quantity: 3,
        category: "flower",
      },
    ]);
  });

  test("returns a new array and does not mutate the input", () => {
    const items: CartItem[] = [{ product: rose, quantity: 1 }];
    const out = toLineItems(items);
    expect(out).not.toBe(items);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(1);
  });
});
