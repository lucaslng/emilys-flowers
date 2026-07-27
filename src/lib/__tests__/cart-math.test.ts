import { test, expect, describe } from "bun:test";
import {
  computeCartTotal,
  computeCartItemCount,
  computeShipping,
} from "@/lib/cart-context";
import type { CartItem, Product } from "@/types";

const rose: Product = {
  id: "test-rose",
  name: "Test Rose",
  description: "A test rose",
  price: 2499,
  images: [],
  category: "flower",
  tags: ["rose", "test"],
  inStock: true,
};

const peony: Product = {
  id: "test-peony",
  name: "Test Peony",
  description: "A test peony",
  price: 2999,
  images: [],
  category: "flower",
  tags: ["peony", "test"],
  inStock: true,
};

describe("computeCartTotal", () => {
  test("empty cart -> 0", () => {
    expect(computeCartTotal([])).toBe(0);
  });

  test("single item, quantity 1 -> product price", () => {
    const items: CartItem[] = [{ product: rose, quantity: 1 }];
    expect(computeCartTotal(items)).toBe(2499);
  });

  test("single item, quantity 3 -> price * 3", () => {
    const items: CartItem[] = [{ product: rose, quantity: 3 }];
    expect(computeCartTotal(items)).toBe(7497);
  });

  test("two different items -> sum of (price * quantity)", () => {
    const items: CartItem[] = [
      { product: rose, quantity: 2 },
      { product: peony, quantity: 3 },
    ];
    // 2499*2 + 2999*3 = 4998 + 8997 = 13995
    expect(computeCartTotal(items)).toBe(13995);
  });
});

describe("computeCartItemCount", () => {
  test("empty cart -> 0", () => {
    expect(computeCartItemCount([])).toBe(0);
  });

  test("single item, quantity 1 -> 1", () => {
    const items: CartItem[] = [{ product: rose, quantity: 1 }];
    expect(computeCartItemCount(items)).toBe(1);
  });

  test("two items, quantities 2 + 3 -> 5", () => {
    const items: CartItem[] = [
      { product: rose, quantity: 2 },
      { product: peony, quantity: 3 },
    ];
    expect(computeCartItemCount(items)).toBe(5);
  });
});

describe("computeShipping", () => {
  test("0 cents -> 599 (flat shipping)", () => {
    expect(computeShipping(0)).toBe(599);
  });

  test("4999 cents (just under $50) -> 599", () => {
    expect(computeShipping(4999)).toBe(599);
  });

  test("5000 cents (exactly $50) -> 0 (free shipping threshold)", () => {
    expect(computeShipping(5000)).toBe(0);
  });

  test("5001 cents (just over $50) -> 0", () => {
    expect(computeShipping(5001)).toBe(0);
  });

  test("14999 cents -> 0", () => {
    expect(computeShipping(14999)).toBe(0);
  });
});