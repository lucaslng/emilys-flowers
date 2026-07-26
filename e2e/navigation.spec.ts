import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("navigate from home to Flowers page", async ({ page }) => {
    await page.goto("/");
    // Use exact match to avoid matching "Emily's Flowers" or "Individual Flowers"
    await page.getByRole("link", { name: "Flowers", exact: true }).click();
    await expect(page).toHaveURL("/flowers");
    await expect(page.locator("h1")).toContainText("Individual Flowers");
  });

  test("navigate to Bouquets page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Bouquets", exact: true }).click();
    await expect(page).toHaveURL("/bouquets");
    await expect(page.locator("h1")).toContainText("Bouquet Collections");
  });

  test("navigate back to Home", async ({ page }) => {
    await page.goto("/bouquets");
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL("/");
  });

  test("click cart icon navigates to cart", async ({ page }) => {
    await page.goto("/");
    await page.locator("#cart-icon").click();
    await expect(page).toHaveURL("/cart");
  });
});
