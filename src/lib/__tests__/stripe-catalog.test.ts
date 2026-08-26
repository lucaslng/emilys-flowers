import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  slugify,
  mapStripeProduct,
  imagesForProduct,
  PLACEHOLDER_DESCRIPTION,
} from "@/lib/stripe-catalog";
import type Stripe from "stripe";

function makePrice(unitAmount: number): Stripe.Price {
  return { unit_amount: unitAmount } as Stripe.Price;
}

function makeProduct(overrides: Partial<Stripe.Product> = {}): Stripe.Product {
  return {
    id: "prod_test123",
    name: "Pink Rose",
    description: null,
    active: true,
    updated: 1756000000,
    metadata: { category: "flower", color: "pink", flower_type: "rose" },
    ...overrides,
  } as Stripe.Product;
}

describe("slugify", () => {
  test("lowercases and hyphenates a product name", () => {
    expect(slugify("Cream White Rose")).toBe("cream-white-rose");
    expect(slugify("Pink Garden")).toBe("pink-garden");
  });

  test("collapses whitespace and strips non-alphanumerics", () => {
    expect(slugify("  Eternal   Roses  ")).toBe("eternal-roses");
    expect(slugify("Aurora Bloom!")).toBe("aurora-bloom");
  });

  test("handles empty / symbol-only names without crashing", () => {
    expect(slugify("")).toBe("");
    expect(slugify("!!!")).toBe("");
  });
});

describe("mapStripeProduct", () => {
  test("maps a flower with placeholder description and category image", () => {
    const p = mapStripeProduct(makeProduct(), makePrice(399));
    expect(p).toEqual({
      id: "prod_test123",
      slug: "pink-rose",
      name: "Pink Rose",
      description: PLACEHOLDER_DESCRIPTION,
      price: 399,
      images: ["/placeholders/flower.svg"],
      category: "flower",
      tags: ["rose", "pink"],
      featured: false,
      featuredOrder: undefined,
      inStock: true,
      flowerType: "rose",
      color: "pink",
      updatedAt: 1756000000,
    });
  });

  test("maps the Stripe updated timestamp to updatedAt", () => {
    const p = mapStripeProduct(
      makeProduct({ updated: 1720000000 }),
      makePrice(399)
    );
    expect(p.updatedAt).toBe(1720000000);
  });

  test("uses the Stripe description when present", () => {
    const p = mapStripeProduct(
      makeProduct({ description: "A lovely rose." }),
      makePrice(399)
    );
    expect(p.description).toBe("A lovely rose.");
  });

  test("maps a featured bouquet with its rank", () => {
    const p = mapStripeProduct(
      makeProduct({
        name: "Aurora Bloom",
        metadata: { category: "bouquet", featured: "2" },
      }),
      makePrice(7999)
    );
    expect(p.category).toBe("bouquet");
    expect(p.images).toEqual(["/placeholders/bouquet.svg"]);
    expect(p.featured).toBe(true);
    expect(p.featuredOrder).toBe(2);
    expect(p.tags).toContain("featured");
    expect(p.slug).toBe("aurora-bloom");
  });

  test("marks inactive products as out of stock", () => {
    const p = mapStripeProduct(makeProduct({ active: false }), makePrice(399));
    expect(p.inStock).toBe(false);
  });

  test("defaults to flower category when metadata.category is absent", () => {
    const p = mapStripeProduct(
      makeProduct({ metadata: { color: "blue" } }),
      makePrice(399)
    );
    expect(p.category).toBe("flower");
  });

  test("uses the price unit_amount as integer cents", () => {
    const p = mapStripeProduct(makeProduct(), makePrice(2499));
    expect(p.price).toBe(2499);
  });
});

describe("imagesForProduct", () => {
  let baseDir: string;

  beforeAll(() => {
    baseDir = mkdtempSync(path.join(tmpdir(), "products-"));
  });

  afterAll(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  test("returns sorted image paths in filename order", () => {
    const slug = "sorted";
    const dir = path.join(baseDir, slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "02-detail.jpg"), "");
    writeFileSync(path.join(dir, "01-main.jpg"), "");
    writeFileSync(path.join(dir, "03-lifestyle.jpg"), "");

    expect(imagesForProduct(slug, "flower", baseDir)).toEqual([
      "/products/sorted/01-main.jpg",
      "/products/sorted/02-detail.jpg",
      "/products/sorted/03-lifestyle.jpg",
    ]);
  });

  test("filters non-image files but keeps case-insensitive image extensions", () => {
    const slug = "filtered";
    const dir = path.join(baseDir, slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "01-main.jpg"), "");
    writeFileSync(path.join(dir, "cover.PNG"), "");
    writeFileSync(path.join(dir, ".DS_Store"), "");
    writeFileSync(path.join(dir, "notes.txt"), "");

    expect(imagesForProduct(slug, "flower", baseDir)).toEqual([
      "/products/filtered/01-main.jpg",
      "/products/filtered/cover.PNG",
    ]);
  });

  test("falls back to the category placeholder when the folder is missing", () => {
    expect(imagesForProduct("no-such-product", "flower", baseDir)).toEqual([
      "/placeholders/flower.svg",
    ]);
    expect(imagesForProduct("no-such-product", "bouquet", baseDir)).toEqual([
      "/placeholders/bouquet.svg",
    ]);
  });

  test("falls back to the category placeholder when the folder has no image files", () => {
    const slug = "empty-folder";
    const dir = path.join(baseDir, slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, ".DS_Store"), "");
    writeFileSync(path.join(dir, "README.md"), "");

    expect(imagesForProduct(slug, "flower", baseDir)).toEqual([
      "/placeholders/flower.svg",
    ]);
    expect(imagesForProduct(slug, "bouquet", baseDir)).toEqual([
      "/placeholders/bouquet.svg",
    ]);
  });
});