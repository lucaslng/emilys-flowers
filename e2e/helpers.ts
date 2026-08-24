import { expect, test, type Page } from "@playwright/test";

export const CART_STORAGE_KEY = "emilys-flowers-cart";

/** Sanitized projection shape returned by GET /api/checkout/session. */
export interface ReceiptFixture {
  items: {
    name: string;
    image: string;
    quantity: number;
    unitAmount: number;
  }[];
  subtotal: number;
  shipping: number;
  total: number;
  orderNumber: string;
}

export const defaultReceipt: ReceiptFixture = {
  items: [
    {
      name: "Aurora Bloom",
      image: "/products/green-evangeline/01-main.jpg",
      quantity: 2,
      unitAmount: 7999,
    },
  ],
  subtotal: 15998,
  shipping: 0,
  total: 15998,
  orderNumber: "EF-TEST",
};

export const successUrl = "/checkout/success?order=EF-TEST&session_id=cs_test_123";

interface SessionOverride {
  status?: number;
  receipt?: Partial<ReceiptFixture>;
}

/** Intercept GET /api/checkout/session so success-page tests never hit Stripe. */
export async function mockReceiptSession(
  page: Page,
  override: SessionOverride = {}
) {
  const body = { ...defaultReceipt, ...override.receipt };
  await page.route(/\/api\/checkout\/session/, (route) =>
    route.fulfill({
      status: override.status ?? 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    })
  );
}

/**
 * Intercept both checkout network hops (POST /api/checkout and GET
 * /api/checkout/session) so tests never hit the real Stripe API.
 */
export async function mockCheckoutApis(
  page: Page,
  session: SessionOverride = {}
) {
  await page.route(/\/api\/checkout$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: successUrl }),
    })
  );
  await mockReceiptSession(page, session);
}

export async function seedCart(page: Page, items: unknown[]) {
  await page.addInitScript(
    ({ key, items }) => localStorage.setItem(key, JSON.stringify(items)),
    { key: CART_STORAGE_KEY, items }
  );
}

/** Add the first catalog product through the real UI (badge assertion left to callers). */
export async function addFirstProductToCart(page: Page) {
  await page.goto("/bouquets");
  await page.getByRole("button", { name: "Add to Cart" }).first().click();
}

/** Shared suite for catalog listing pages; each page keeps its own spec file. */
export function describeCatalogPageSuite(suiteName: string, path: string) {
  test.describe(suiteName, () => {
    test("loads and displays product cards with Add to Cart buttons", async ({ page }) => {
      await page.goto(path);
      const addToCartButtons = page.getByRole("button", { name: "Add to Cart" });
      // Catalog is fetched from Stripe at build time, so assert at least one product rather than a hardcoded count.
      await expect(addToCartButtons.first()).toBeVisible();
    });

    test("each card shows a price in $X.XX format", async ({ page }) => {
      await page.goto(path);
      const priceElements = page.locator('[class*="tabular-nums"]');
      const count = await priceElements.count();
      expect(count).toBeGreaterThanOrEqual(1);
      for (let i = 0; i < count; i++) {
        const priceText = await priceElements.nth(i).textContent();
        expect(priceText).toMatch(/^\$\d+\.\d{2}$/);
      }
    });
  });
}
