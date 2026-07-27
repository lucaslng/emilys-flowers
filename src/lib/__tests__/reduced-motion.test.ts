import { test, expect, describe } from "bun:test";
import { prefersReducedMotion } from "@/lib/reduced-motion";

describe("prefersReducedMotion", () => {
  test("returns false in non-browser / SSR environments (no window)", () => {
    expect(prefersReducedMotion()).toBe(false);
  });
});
