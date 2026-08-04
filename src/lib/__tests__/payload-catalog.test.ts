import { test, expect, describe } from "bun:test";
import {
  slugify,
  mapPayloadProduct,
  PLACEHOLDER_DESCRIPTION,
  type PayloadProductDoc,
} from "@/lib/payload-catalog";

function makeDoc(overrides: Partial<PayloadProductDoc> = {}): PayloadProductDoc {
  return {
    id: "66f1a2b3c4d5e6f7a8b9c0d1",
    name: "Pink Rose",
    slug: "pink-rose",
    description: "",
    price: 399,
    category: "flower",
    tags: [{ tag: "rose" }, { tag: "pink" }],
    featured: false,
    featuredOrder: null,
    inStock: true,
    flowerType: "rose",
    color: "pink",
    ...overrides,
  };
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

describe("mapPayloadProduct", () => {
  test("maps a flower with placeholder description and category image", () => {
    const p = mapPayloadProduct(makeDoc());
    expect(p).toEqual({
      id: "66f1a2b3c4d5e6f7a8b9c0d1",
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
    });
  });

  test("uses the doc description when present", () => {
    const p = mapPayloadProduct(makeDoc({ description: "A lovely rose." }));
    expect(p.description).toBe("A lovely rose.");
  });

  test("maps a featured bouquet with its rank", () => {
    const p = mapPayloadProduct(
      makeDoc({
        name: "Aurora Bloom",
        slug: "aurora-bloom",
        category: "bouquet",
        price: 7999,
        featured: true,
        featuredOrder: 2,
      })
    );
    expect(p.category).toBe("bouquet");
    expect(p.images).toEqual(["/placeholders/bouquet.svg"]);
    expect(p.featured).toBe(true);
    expect(p.featuredOrder).toBe(2);
    expect(p.tags).toContain("featured");
    expect(p.slug).toBe("aurora-bloom");
  });

  test("marks out-of-stock docs as such, defaults to in stock when absent", () => {
    expect(mapPayloadProduct(makeDoc({ inStock: false })).inStock).toBe(false);
    expect(mapPayloadProduct(makeDoc({ inStock: undefined })).inStock).toBe(true);
  });

  test("defaults to flower category when category is absent or unknown", () => {
    expect(mapPayloadProduct(makeDoc({ category: "" })).category).toBe("flower");
    expect(mapPayloadProduct(makeDoc({ category: undefined })).category).toBe("flower");
  });

  test("uses the doc price as integer cents", () => {
    expect(mapPayloadProduct(makeDoc({ price: 2499 })).price).toBe(2499);
  });

  test("uses media URLs as images when present", () => {
    const p = mapPayloadProduct(
      makeDoc({
        media: [
          { url: "https://utfs.io/f/abc123" },
          { url: null },
          { url: "https://utfs.io/f/def456" },
        ],
      })
    );
    expect(p.images).toEqual([
      "https://utfs.io/f/abc123",
      "https://utfs.io/f/def456",
    ]);
  });

  test("falls back to the category placeholder when media is empty or url-less", () => {
    expect(mapPayloadProduct(makeDoc({ media: [] })).images).toEqual([
      "/placeholders/flower.svg",
    ]);
    expect(mapPayloadProduct(makeDoc({ media: [{ url: null }] })).images).toEqual([
      "/placeholders/flower.svg",
    ]);
  });

  test("featured checkbox alone (no rank) marks the product featured", () => {
    const p = mapPayloadProduct(makeDoc({ featured: true, featuredOrder: null }));
    expect(p.featured).toBe(true);
    expect(p.featuredOrder).toBe(undefined);
    expect(p.tags).toContain("featured");
  });

  test("derives tags from flowerType and color only when present", () => {
    const p = mapPayloadProduct(
      makeDoc({ flowerType: null, color: null, tags: [] })
    );
    expect(p.tags).toEqual([]);
  });
});
