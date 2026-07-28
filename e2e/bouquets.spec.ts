import { test, expect } from "@playwright/test";

test.describe("Bouquets page", () => {
  test("loads and displays 11 product cards with Add to Cart buttons", async ({ page }) => {
    await page.goto("/bouquets");
    const addToCartButtons = page.getByRole("button", { name: "Add to Cart" });
    await expect(addToCartButtons).toHaveCount(11);
  });

  test("each card shows a price in $X.XX format", async ({ page }) => {
    await page.goto("/bouquets");
    const priceElements = page.locator('[class*="tabular-nums"]');
    const count = await priceElements.count();
    expect(count).toBe(11);
    for (let i = 0; i < count; i++) {
      const priceText = await priceElements.nth(i).textContent();
      expect(priceText).toMatch(/^CA\$\d+\.\d{2}$/);
    }
  });
});
