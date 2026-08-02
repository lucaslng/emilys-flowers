import { test, expect, describe } from "bun:test";
import { cartReducer } from "@/lib/cart-context";
import type { Product } from "@/types";

const sampleProduct: Product = {
  id: "test-rose",
  name: "Test Rose",
  description: "A test rose",
  price: 2499,
  images: [],
  category: "flower",
  tags: ["rose", "test"],
  inStock: true,
};

const sampleProduct2: Product = {
  id: "test-peony",
  name: "Test Peony",
  description: "A test peony",
  price: 2999,
  images: [],
  category: "flower",
  tags: ["peony", "test"],
  inStock: true,
};

const initialState = { items: [] };

describe("cartReducer", () => {
  test("ADD_TO_CART with new product adds item with quantity 1", () => {
    const state = cartReducer(initialState, {
      type: "ADD_TO_CART",
      payload: sampleProduct,
    });
    expect(state.items).toHaveLength(1);
    expect(state.items[0].product.id).toBe("test-rose");
    expect(state.items[0].quantity).toBe(1);
  });

  test("ADD_TO_CART with existing product increments quantity", () => {
    const stateWithItem = cartReducer(initialState, {
      type: "ADD_TO_CART",
      payload: sampleProduct,
    });
    const state = cartReducer(stateWithItem, {
      type: "ADD_TO_CART",
      payload: sampleProduct,
    });
    expect(state.items).toHaveLength(1);
    expect(state.items[0].quantity).toBe(2);
  });

  test("ADD_TO_CART adds different products as separate items", () => {
    const stateWithItem = cartReducer(initialState, {
      type: "ADD_TO_CART",
      payload: sampleProduct,
    });
    const state = cartReducer(stateWithItem, {
      type: "ADD_TO_CART",
      payload: sampleProduct2,
    });
    expect(state.items).toHaveLength(2);
    expect(state.items[0].product.id).toBe("test-rose");
    expect(state.items[1].product.id).toBe("test-peony");
  });

  test("REMOVE_FROM_CART removes the specified item", () => {
    const stateWithItem = cartReducer(initialState, {
      type: "ADD_TO_CART",
      payload: sampleProduct,
    });
    const state = cartReducer(stateWithItem, {
      type: "REMOVE_FROM_CART",
      payload: "test-rose",
    });
    expect(state.items).toHaveLength(0);
  });

  test("REMOVE_FROM_CART with nonexistent id leaves state unchanged", () => {
    const stateWithItem = cartReducer(initialState, {
      type: "ADD_TO_CART",
      payload: sampleProduct,
    });
    const state = cartReducer(stateWithItem, {
      type: "REMOVE_FROM_CART",
      payload: "nonexistent",
    });
    expect(state.items).toHaveLength(1);
  });

  test("UPDATE_QUANTITY to positive value updates the quantity", () => {
    const stateWithItem = cartReducer(initialState, {
      type: "ADD_TO_CART",
      payload: sampleProduct,
    });
    const state = cartReducer(stateWithItem, {
      type: "UPDATE_QUANTITY",
      payload: { id: "test-rose", quantity: 5 },
    });
    expect(state.items[0].quantity).toBe(5);
  });

  test("UPDATE_QUANTITY to 0 removes the item", () => {
    const stateWithItem = cartReducer(initialState, {
      type: "ADD_TO_CART",
      payload: sampleProduct,
    });
    const state = cartReducer(stateWithItem, {
      type: "UPDATE_QUANTITY",
      payload: { id: "test-rose", quantity: 0 },
    });
    expect(state.items).toHaveLength(0);
  });

  test("UPDATE_QUANTITY to negative removes the item", () => {
    const stateWithItem = cartReducer(initialState, {
      type: "ADD_TO_CART",
      payload: sampleProduct,
    });
    const state = cartReducer(stateWithItem, {
      type: "UPDATE_QUANTITY",
      payload: { id: "test-rose", quantity: -1 },
    });
    expect(state.items).toHaveLength(0);
  });

  // Regression: quantities must stay positive integers (cart badge, order
  // math, and the Stripe payload all assume integer counts). NaN and Infinity
  // previously slipped through the `<= 0` guard and were serialized as `null`
  // into localStorage.
  test("UPDATE_QUANTITY with NaN removes the item", () => {
    const stateWithItem = cartReducer(initialState, {
      type: "ADD_TO_CART",
      payload: sampleProduct,
    });
    const state = cartReducer(stateWithItem, {
      type: "UPDATE_QUANTITY",
      payload: { id: "test-rose", quantity: NaN },
    });
    expect(state.items).toHaveLength(0);
  });

  test("UPDATE_QUANTITY with Infinity removes the item", () => {
    const stateWithItem = cartReducer(initialState, {
      type: "ADD_TO_CART",
      payload: sampleProduct,
    });
    const state = cartReducer(stateWithItem, {
      type: "UPDATE_QUANTITY",
      payload: { id: "test-rose", quantity: Infinity },
    });
    expect(state.items).toHaveLength(0);
  });

  test("UPDATE_QUANTITY with a fractional quantity removes the item", () => {
    const stateWithItem = cartReducer(initialState, {
      type: "ADD_TO_CART",
      payload: sampleProduct,
    });
    const state = cartReducer(stateWithItem, {
      type: "UPDATE_QUANTITY",
      payload: { id: "test-rose", quantity: 1.5 },
    });
    expect(state.items).toHaveLength(0);
  });

  test("UPDATE_QUANTITY with nonexistent id leaves state unchanged", () => {
    const stateWithItem = cartReducer(initialState, {
      type: "ADD_TO_CART",
      payload: sampleProduct,
    });
    const state = cartReducer(stateWithItem, {
      type: "UPDATE_QUANTITY",
      payload: { id: "nonexistent", quantity: 5 },
    });
    expect(state.items).toHaveLength(1);
    expect(state.items[0].quantity).toBe(1);
  });

  test("UPDATE_QUANTITY leaves unrelated items untouched", () => {
    const withBoth = cartReducer(
      cartReducer(initialState, { type: "ADD_TO_CART", payload: sampleProduct }),
      { type: "ADD_TO_CART", payload: sampleProduct2 }
    );
    const state = cartReducer(withBoth, {
      type: "UPDATE_QUANTITY",
      payload: { id: "test-rose", quantity: 4 },
    });
    expect(state.items).toHaveLength(2);
    expect(state.items[0].quantity).toBe(4);
    expect(state.items[1].product.id).toBe("test-peony");
    expect(state.items[1].quantity).toBe(1);
  });

  test("CLEAR_CART empties the items array", () => {
    const stateWithItem = cartReducer(initialState, {
      type: "ADD_TO_CART",
      payload: sampleProduct,
    });
    const state = cartReducer(stateWithItem, { type: "CLEAR_CART" });
    expect(state.items).toHaveLength(0);
  });

  test("HYDRATE replaces items with payload", () => {
    const payload = [
      { product: sampleProduct, quantity: 3 },
      { product: sampleProduct2, quantity: 2 },
    ];
    const state = cartReducer(initialState, {
      type: "HYDRATE",
      payload,
    });
    expect(state.items).toHaveLength(2);
    expect(state.items[0].quantity).toBe(3);
    expect(state.items[1].quantity).toBe(2);
  });

  test("unknown action type returns state unchanged", () => {
    const stateWithItem = cartReducer(initialState, {
      type: "ADD_TO_CART",
      payload: sampleProduct,
    });
    const state = cartReducer(stateWithItem, {
      // @ts-expect-error testing unknown action type
      type: "UNKNOWN_ACTION",
    });
    expect(state).toBe(stateWithItem);
  });

  test("reducer is pure: same input produces equal (not same reference) state", () => {
    const state1 = cartReducer(initialState, {
      type: "ADD_TO_CART",
      payload: sampleProduct,
    });
    const state2 = cartReducer(initialState, {
      type: "ADD_TO_CART",
      payload: sampleProduct,
    });
    expect(state1).toEqual(state2);
    expect(state1).not.toBe(state2);
  });

  test("original state is not mutated", () => {
    const originalState = { items: [...initialState.items] };
    cartReducer(originalState, {
      type: "ADD_TO_CART",
      payload: sampleProduct,
    });
    expect(originalState.items).toHaveLength(0);
  });
});
