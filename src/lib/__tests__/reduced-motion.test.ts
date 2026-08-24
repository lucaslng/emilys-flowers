import { test, expect, describe, afterEach } from "bun:test";
import { prefersReducedMotion } from "@/lib/reduced-motion";

// The browser branch runs against a stubbed window.matchMedia; afterEach restores it so the SSR case below stays hermetic.
afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe("prefersReducedMotion", () => {
  test("returns false in non-browser / SSR environments (no window)", () => {
    expect(prefersReducedMotion()).toBe(false);
  });

  test("returns true when matchMedia reports (prefers-reduced-motion: reduce)", () => {
    (globalThis as Record<string, unknown>).window = {
      matchMedia: () => ({ matches: true }),
    } as never;
    expect(prefersReducedMotion()).toBe(true);
  });

  test("returns false when matchMedia reports no-preference", () => {
    (globalThis as Record<string, unknown>).window = {
      matchMedia: () => ({ matches: false }),
    } as never;
    expect(prefersReducedMotion()).toBe(false);
  });

  test("returns false when window exists but matchMedia is unavailable", () => {
    (globalThis as Record<string, unknown>).window = {} as never;
    expect(prefersReducedMotion()).toBe(false);
  });
});
