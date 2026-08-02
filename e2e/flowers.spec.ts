import { test, expect } from "@playwright/test";

test.describe("Flowers page", () => {
  test("loads and displays 36 product cards with Add to Cart buttons", async ({ page }) => {
    await page.goto("/flowers");
    const addToCartButtons = page.getByRole("button", { name: "Add to Cart" });
    await expect(addToCartButtons).toHaveCount(36);
  });

  test("each card shows a price in $X.XX format", async ({ page }) => {
    await page.goto("/flowers");
    // Prices are rendered as spans with class containing tabular-nums
    const priceElements = page.locator('[class*="tabular-nums"]');
    const count = await priceElements.count();
    expect(count).toBe(36);
    for (let i = 0; i < count; i++) {
      const priceText = await priceElements.nth(i).textContent();
      expect(priceText).toMatch(/^\$\d+\.\d{2}$/);
    }
  });
});
