import { test, expect, describe } from "bun:test";
import {
  organizationSchema,
  webSiteSchema,
  itemListSchema,
  productSchema,
  breadcrumbSchema,
} from "@/lib/json-ld";
import { SITE_URL } from "@/lib/site";
import type { Product } from "@/types";

function product(overrides: Partial<Product>): Product {
  return {
    id: "p",
    slug: "p",
    name: "P",
    description: "d",
    price: 1000,
    images: ["/placeholders/flower.svg"],
    category: "flower",
    tags: [],
    inStock: true,
    ...overrides,
  };
}

describe("organizationSchema", () => {
  test("includes context, type, name, url, and priceRange", () => {
    const schema = organizationSchema();
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toContain("Organization");
    expect(schema["@type"]).toContain("Store");
    expect(schema.name).toBe("Emily's Flowers");
    expect(schema.url).toBe(SITE_URL);
    expect(schema.logo).toBe(`${SITE_URL}/apple-touch-icon.png`);
    expect(schema.priceRange).toBe("$$");
  });
});

describe("webSiteSchema", () => {
  test("includes context, type, name, and url", () => {
    const schema = webSiteSchema();
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("WebSite");
    expect(schema.name).toBe("Emily's Flowers");
    expect(schema.url).toBe(SITE_URL);
  });
});

describe("itemListSchema", () => {
  test("produces correct positions, names, and absolute URLs", () => {
    const products = [
      product({ slug: "rose", name: "Rose" }),
      product({ slug: "peony", name: "Peony" }),
    ];
    const schema = itemListSchema(products, "Handcrafted Ribbon Flowers");
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("ItemList");
    expect(schema.name).toBe("Handcrafted Ribbon Flowers");
    expect(schema.itemListElement).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "Rose",
        url: `${SITE_URL}/products/rose`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Peony",
        url: `${SITE_URL}/products/peony`,
      },
    ]);
  });
});

describe("productSchema", () => {
  test("produces correct price, currency, availability, and absolute image URL", () => {
    const schema = productSchema(product({ price: 2499, inStock: true }));
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("Product");
    expect(schema.name).toBe("P");
    expect(schema.image).toEqual([`${SITE_URL}/placeholders/flower.svg`]);
    expect(schema.brand).toEqual({ "@type": "Brand", name: "Emily's Flowers" });
    expect(schema.offers.priceCurrency).toBe("CAD");
    expect(schema.offers.price).toBe("24.99");
    expect(schema.offers.availability).toBe("https://schema.org/InStock");
    expect(schema.offers.url).toBe(`${SITE_URL}/products/p`);
  });

  test("uses OutOfStock when inStock is false", () => {
    const schema = productSchema(product({ inStock: false }));
    expect(schema.offers.availability).toBe("https://schema.org/OutOfStock");
  });
});

describe("breadcrumbSchema", () => {
  test("produces correct positions, names, and urls", () => {
    const schema = breadcrumbSchema([
      { name: "Home", url: SITE_URL },
      { name: "Flowers", url: `${SITE_URL}/flowers` },
    ]);
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("BreadcrumbList");
    expect(schema.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Flowers",
        item: `${SITE_URL}/flowers`,
      },
    ]);
  });
});