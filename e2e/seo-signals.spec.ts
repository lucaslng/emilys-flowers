import { test, expect } from "@playwright/test";

const ORIGIN = "https://emilysflowers.ca";

type JsonLdType = string | readonly string[];

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTypes(node: JsonValue): JsonLdType | undefined {
  if (!isJsonObject(node)) return undefined;
  const type = node["@type"];
  if (typeof type === "string") return type;
  if (Array.isArray(type) && type.every((t) => typeof t === "string")) {
    return type as readonly string[];
  }
  return undefined;
}

function hasType(types: JsonLdType | undefined, wanted: string): boolean {
  if (types === undefined) return false;
  return typeof types === "string" ? types === wanted : types.includes(wanted);
}

function extractJsonLdBlobs(html: string): JsonValue[] {
  const blobs: JsonValue[] = [];
  const pattern =
    /<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    // Malformed JSON-LD must fail loudly here rather than silently shrink coverage.
    blobs.push(JSON.parse(match[1] ?? "") as JsonValue);
  }
  return blobs;
}

test.describe("SEO crawl and index signals", () => {
  test("robots.txt advertises the production sitemap and keeps transactional routes out of the index", async ({
    request,
  }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
    expect(body).toContain("Disallow: /cart");
    expect(body).toContain("Disallow: /checkout");
    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("Disallow: /admin");
  });

  test("sitemap.xml lists core pages and at least one product URL", async ({
    request,
  }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const body = await response.text();
    const corePaths = ["", "/bouquets", "/faq", "/terms", "/privacy"];
    for (const path of corePaths) {
      expect(body).toContain(`<loc>${ORIGIN}${path}</loc>`);
    }
    expect(body).toMatch(
      new RegExp(`<loc>${ORIGIN.replace(/\./g, "\\.")}/products/[^<]+</loc>`),
    );
  });

  test("home page exposes Organization and WebSite structured data", async ({
    request,
  }) => {
    const response = await request.get("/");
    expect(response.status()).toBe(200);
    const html = await response.text();
    const blobs = extractJsonLdBlobs(html);
    expect(blobs.length).toBeGreaterThan(0);

    const hasOrganizationOrStore = blobs.some((blob) =>
      hasType(readTypes(blob), "Organization") ||
      hasType(readTypes(blob), "Store"),
    );
    const hasWebSite = blobs.some((blob) => hasType(readTypes(blob), "WebSite"));
    expect(hasOrganizationOrStore).toBe(true);
    expect(hasWebSite).toBe(true);
  });

  test("cart page sends a noindex robots directive", async ({ request }) => {
    const response = await request.get("/cart");
    expect(response.status()).toBe(200);
    const html = await response.text();
    const robotsMeta = html.match(
      /<meta\s+[^>]*name=["']robots["'][^>]*>/i,
    );
    expect(robotsMeta).not.toBeNull();
    expect(robotsMeta?.[0]).toMatch(/noindex/i);
  });

  test("product page exposes Product (CAD pricing) and BreadcrumbList structured data", async ({
    request,
  }) => {
    const response = await request.get("/products/dreamy-pink");
    expect(response.status()).toBe(200);
    const html = await response.text();
    const blobs = extractJsonLdBlobs(html);
    expect(blobs.length).toBeGreaterThan(0);

    const nodes: JsonValue[] = [];
    const visit = (value: JsonValue): void => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (isJsonObject(value)) {
        nodes.push(value);
        Object.values(value).forEach(visit);
      }
    };
    blobs.forEach(visit);

    const productNode = nodes.find((node) => hasType(readTypes(node), "Product"));
    expect(productNode).toBeDefined();
    if (!productNode || !isJsonObject(productNode)) return;
    const offers = productNode["offers"];
    expect(isJsonObject(offers)).toBe(true);
    if (isJsonObject(offers)) {
      expect(offers["priceCurrency"]).toBe("CAD");
    }

    expect(
      nodes.some((node) => hasType(readTypes(node), "BreadcrumbList")),
    ).toBe(true);
  });
});
