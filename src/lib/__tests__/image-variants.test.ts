import { test, expect, describe } from "bun:test";
import {
  VARIANT_WIDTHS,
  nearestVariantWidth,
  variantPathFor,
  variantFileFor,
} from "@/lib/image-variants";

describe("VARIANT_WIDTHS", () => {
  test("exposes the canonical variant widths", () => {
    expect(VARIANT_WIDTHS).toEqual([320, 480, 640, 960, 1280, 1600]);
  });
});

describe("nearestVariantWidth", () => {
  test("rounds below the smallest variant up to 320", () => {
    expect(nearestVariantWidth(100)).toBe(320);
    expect(nearestVariantWidth(300)).toBe(320);
  });

  test("rounds to the closest variant", () => {
    expect(nearestVariantWidth(500)).toBe(480);
    expect(nearestVariantWidth(700)).toBe(640);
    expect(nearestVariantWidth(1000)).toBe(960);
  });

  test("prefers the larger width on ties", () => {
    expect(nearestVariantWidth(400)).toBe(480); // 320 vs 480
    expect(nearestVariantWidth(800)).toBe(960); // 640 vs 960
    expect(nearestVariantWidth(1120)).toBe(1280); // 960 vs 1280
  });

  test("returns the exact width on an exact match", () => {
    expect(nearestVariantWidth(320)).toBe(320);
    expect(nearestVariantWidth(640)).toBe(640);
    expect(nearestVariantWidth(1600)).toBe(1600);
  });

  test("caps above the largest variant at 1600", () => {
    expect(nearestVariantWidth(2000)).toBe(1600);
    expect(nearestVariantWidth(4096)).toBe(1600);
  });
});

describe("variantPathFor", () => {
  test("maps a jpg product image to its nearest WebP variant", () => {
    expect(variantPathFor("/products/creamy-white/01-main.jpg", 480)).toBe(
      "/products/creamy-white/variants/01-main-480.webp"
    );
  });

  test("maps a png product image to its nearest WebP variant", () => {
    expect(variantPathFor("/products/dreamy-pink/cover.png", 500)).toBe(
      "/products/dreamy-pink/variants/cover-480.webp"
    );
  });

  test("maps a webp product image to its nearest WebP variant", () => {
    expect(variantPathFor("/products/pink-evangeline/02-detail.webp", 800)).toBe(
      "/products/pink-evangeline/variants/02-detail-960.webp"
    );
  });

  test("matches extensions case-insensitively", () => {
    expect(variantPathFor("/products/creamy-white/cover.JPG", 320)).toBe(
      "/products/creamy-white/variants/cover-320.webp"
    );
  });

  test("passes through non-product URLs unchanged", () => {
    expect(variantPathFor("/placeholders/flower.svg", 480)).toBe(
      "/placeholders/flower.svg"
    );
    expect(variantPathFor("/products/x/variants/y-480.webp", 480)).toBe(
      "/products/x/variants/y-480.webp"
    );
    expect(variantPathFor("https://example.com/photo.jpg", 480)).toBe(
      "https://example.com/photo.jpg"
    );
  });
});

describe("variantFileFor", () => {
  test("maps a product file path to its nearest WebP variant", () => {
    expect(
      variantFileFor("public/products/creamy-white/01-main.jpg", 480)
    ).toBe("public/products/creamy-white/variants/01-main-480.webp");
  });

  test("maps a png file path to its nearest WebP variant", () => {
    expect(
      variantFileFor("public/products/dreamy-pink/cover.png", 500)
    ).toBe("public/products/dreamy-pink/variants/cover-480.webp");
  });

  test("preserves a leading directory prefix", () => {
    expect(
      variantFileFor("/repo/public/products/creamy-white/01-main.jpg", 960)
    ).toBe("/repo/public/products/creamy-white/variants/01-main-960.webp");
  });

  test("passes through non-product file paths unchanged", () => {
    expect(variantFileFor("public/placeholders/flower.svg", 480)).toBe(
      "public/placeholders/flower.svg"
    );
    expect(
      variantFileFor("public/products/creamy-white/variants/01-main-480.webp", 480)
    ).toBe("public/products/creamy-white/variants/01-main-480.webp");
    expect(variantFileFor("notes.txt", 480)).toBe("notes.txt");
  });
});