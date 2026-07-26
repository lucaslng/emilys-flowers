import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("page loads with Emily's Flowers visible in nav", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav")).toContainText("Emily's Flowers");
  });

  test("featured bouquets section renders Add to Cart buttons", async ({ page }) => {
    await page.goto("/");
    const addToCartButtons = page.getByRole("button", { name: "Add to Cart" });
    await expect(addToCartButtons.first()).toBeVisible();
    // At least one featured product card should have an "Add to Cart" button
    await expect(addToCartButtons.first()).toBeEnabled();
  });
});
