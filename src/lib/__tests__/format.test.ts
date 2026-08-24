import { test, expect, describe } from "bun:test";
import { formatCAD, formatPrice, formatShippingLabel } from "@/lib/format";

describe("formatPrice", () => {
  test("2499 cents -> '24.99'", () => {
    expect(formatPrice(2499)).toBe("24.99");
  });

  test("0 cents -> '0.00'", () => {
    expect(formatPrice(0)).toBe("0.00");
  });

  test("100 cents -> '1.00'", () => {
    expect(formatPrice(100)).toBe("1.00");
  });

  test("5 cents -> '0.05'", () => {
    expect(formatPrice(5)).toBe("0.05");
  });

  test("14999 cents -> '149.99'", () => {
    expect(formatPrice(14999)).toBe("149.99");
  });

  test("999 cents -> '9.99'", () => {
    expect(formatPrice(999)).toBe("9.99");
  });

  test("123456 cents -> '1234.56'", () => {
    expect(formatPrice(123456)).toBe("1234.56");
  });
});

describe("formatCAD", () => {
  test("2499 cents -> '$24.99'", () => {
    expect(formatCAD(2499)).toBe("$24.99");
  });

  test("0 cents -> '$0.00'", () => {
    expect(formatCAD(0)).toBe("$0.00");
  });

  test("5 cents -> '$0.05'", () => {
    expect(formatCAD(5)).toBe("$0.05");
  });
});

describe("formatShippingLabel", () => {
  test("0 cents -> 'Free'", () => {
    expect(formatShippingLabel(0)).toBe("Free");
  });

  test("599 cents -> '$5.99'", () => {
    expect(formatShippingLabel(599)).toBe("$5.99");
  });
});
