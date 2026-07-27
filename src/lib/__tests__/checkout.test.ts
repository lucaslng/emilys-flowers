import { test, expect, describe } from "bun:test";
import { validateLineItems } from "@/lib/checkout";

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
});