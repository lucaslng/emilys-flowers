import { test, expect, describe } from "bun:test";
import { formatPrice } from "@/lib/format";

describe("formatPrice", () => {
  test("2499 cents -> 'CA$24.99'", () => {
    expect(formatPrice(2499)).toBe("CA$24.99");
  });

  test("0 cents -> 'CA$0.00'", () => {
    expect(formatPrice(0)).toBe("CA$0.00");
  });

  test("100 cents -> 'CA$1.00'", () => {
    expect(formatPrice(100)).toBe("CA$1.00");
  });

  test("5 cents -> 'CA$0.05'", () => {
    expect(formatPrice(5)).toBe("CA$0.05");
  });

  test("14999 cents -> 'CA$149.99'", () => {
    expect(formatPrice(14999)).toBe("CA$149.99");
  });

  test("999 cents -> 'CA$9.99'", () => {
    expect(formatPrice(999)).toBe("CA$9.99");
  });

  test("123456 cents -> 'CA$1234.56'", () => {
    expect(formatPrice(123456)).toBe("CA$1234.56");
  });
});