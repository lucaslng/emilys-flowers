import { test, expect, describe } from "bun:test";
import { validateLineItems } from "@/lib/order";

describe("validateLineItems", () => {
  test("empty array -> 'No items provided'", () => {
    expect(validateLineItems([])).toEqual({
      ok: false,
      error: "No items provided",
    });
  });

  test("undefined -> 'No items provided'", () => {
    expect(validateLineItems(undefined)).toEqual({
      ok: false,
      error: "No items provided",
    });
  });

  test("null -> 'No items provided'", () => {
    expect(validateLineItems(null)).toEqual({
      ok: false,
      error: "No items provided",
    });
  });

  test("valid single item -> ok", () => {
    expect(
      validateLineItems([{ id: "x", name: "Y", price: 2499, quantity: 1 }])
    ).toEqual({ ok: true });
  });

  test("valid two items -> ok", () => {
    expect(
      validateLineItems([
        { id: "x", name: "Y", price: 2499, quantity: 1 },
        { id: "z", name: "W", price: 8999, quantity: 2 },
      ])
    ).toEqual({ ok: true });
  });

  test("item with empty id -> 'Invalid line item'", () => {
    expect(
      validateLineItems([{ id: "", name: "Y", price: 2499, quantity: 1 }])
    ).toEqual({ ok: false, error: "Invalid line item" });
  });

  test("item with whitespace-only name -> 'Invalid line item'", () => {
    expect(
      validateLineItems([{ id: "x", name: "  ", price: 2499, quantity: 1 }])
    ).toEqual({ ok: false, error: "Invalid line item" });
  });

  test("item with price 0 -> 'Invalid line item'", () => {
    expect(
      validateLineItems([{ id: "x", name: "Y", price: 0, quantity: 1 }])
    ).toEqual({ ok: false, error: "Invalid line item" });
  });

  test("item with negative price -> 'Invalid line item'", () => {
    expect(
      validateLineItems([{ id: "x", name: "Y", price: -1, quantity: 1 }])
    ).toEqual({ ok: false, error: "Invalid line item" });
  });

  test("item with non-integer price (24.99) -> 'Invalid line item'", () => {
    expect(
      validateLineItems([{ id: "x", name: "Y", price: 24.99, quantity: 1 }])
    ).toEqual({ ok: false, error: "Invalid line item" });
  });

  test("item with quantity 0 -> 'Invalid line item'", () => {
    expect(
      validateLineItems([{ id: "x", name: "Y", price: 2499, quantity: 0 }])
    ).toEqual({ ok: false, error: "Invalid line item" });
  });

  test("item with negative quantity -> 'Invalid line item'", () => {
    expect(
      validateLineItems([{ id: "x", name: "Y", price: 2499, quantity: -1 }])
    ).toEqual({ ok: false, error: "Invalid line item" });
  });

  test("item with non-integer quantity (1.5) -> 'Invalid line item'", () => {
    expect(
      validateLineItems([{ id: "x", name: "Y", price: 2499, quantity: 1.5 }])
    ).toEqual({ ok: false, error: "Invalid line item" });
  });

  test("item that is null -> 'Invalid line item'", () => {
    expect(validateLineItems([null])).toEqual({
      ok: false,
      error: "Invalid line item",
    });
  });

  test("non-array items (object) -> 'No items provided'", () => {
    expect(validateLineItems({ items: [] })).toEqual({
      ok: false,
      error: "No items provided",
    });
  });

  test("non-array items (string) -> 'No items provided'", () => {
    expect(validateLineItems("items")).toEqual({
      ok: false,
      error: "No items provided",
    });
  });

  test("item that is a string -> 'Invalid line item'", () => {
    expect(validateLineItems(["x"])).toEqual({
      ok: false,
      error: "Invalid line item",
    });
  });

  test("item that is an array -> 'Invalid line item'", () => {
    expect(validateLineItems([["x"]])).toEqual({
      ok: false,
      error: "Invalid line item",
    });
  });

  test("item that is a number -> 'Invalid line item'", () => {
    expect(validateLineItems([42])).toEqual({
      ok: false,
      error: "Invalid line item",
    });
  });

  test("price NaN -> 'Invalid line item'", () => {
    expect(
      validateLineItems([{ id: "x", name: "Y", price: NaN, quantity: 1 }])
    ).toEqual({ ok: false, error: "Invalid line item" });
  });

  test("price Infinity -> 'Invalid line item'", () => {
    expect(
      validateLineItems([{ id: "x", name: "Y", price: Infinity, quantity: 1 }])
    ).toEqual({ ok: false, error: "Invalid line item" });
  });

  test("quantity NaN -> 'Invalid line item'", () => {
    expect(
      validateLineItems([{ id: "x", name: "Y", price: 2499, quantity: NaN }])
    ).toEqual({ ok: false, error: "Invalid line item" });
  });

  test("quantity Infinity -> 'Invalid line item'", () => {
    expect(
      validateLineItems([{ id: "x", name: "Y", price: 2499, quantity: Infinity }])
    ).toEqual({ ok: false, error: "Invalid line item" });
  });

  test("valid item with extra fields -> ok (lenient)", () => {
    expect(
      validateLineItems([
        { id: "x", name: "Y", price: 2499, quantity: 1, color: "red", sku: "x-1" },
      ])
    ).toEqual({ ok: true });
  });

  test("duplicate valid items -> ok (dedup is client-side, not validation's job)", () => {
    const item = { id: "x", name: "Y", price: 2499, quantity: 1 };
    expect(validateLineItems([item, item])).toEqual({ ok: true });
  });
});