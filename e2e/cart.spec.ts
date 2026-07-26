import { test, expect } from "@playwright/test";

test.describe("Cart functionality", () => {
  test("empty cart shows empty state", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.locator("h2")).toContainText("Your cart is empty");
    await expect(page.getByRole("link", { name: "Shop Bouquets" })).toBeVisible();
  });

  test("add item to cart from bouquets page", async ({ page }) => {
    await page.goto("/bouquets");
    await page.getByRole("button", { name: "Add to Cart" }).first().click();
    // Cart badge should show "1"
    await expect(page.locator("#cart-icon span")).toContainText("1");
  });

  test("cart displays added item with quantity controls", async ({ page }) => {
    await page.goto("/bouquets");
    await page.getByRole("button", { name: "Add to Cart" }).first().click();
    await page.goto("/cart");

    // Product name visible via remove button aria-label
    const removeButton = page.getByRole("button", { name: /Remove.*from cart/ }).first();
    await expect(removeButton).toBeVisible();

    // Quantity shows "1" — use the quantity span inside the cart item
    await expect(page.locator('[class*="flex h-8 w-10 items-center justify-center"]')).toContainText("1");

    // Proceed to Checkout visible
    await expect(page.getByRole("link", { name: "Proceed to Checkout" })).toBeVisible();
  });

  test("increase quantity works", async ({ page }) => {
    await page.goto("/bouquets");
    await page.getByRole("button", { name: "Add to Cart" }).first().click();
    await page.goto("/cart");

    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.locator('[class*="flex h-8 w-10 items-center justify-center"]')).toContainText("2");
  });

  test("decrease quantity works", async ({ page }) => {
    await page.goto("/bouquets");
    await page.getByRole("button", { name: "Add to Cart" }).first().click();
    await page.goto("/cart");

    // Increase to 2 first so decrease works
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.locator('[class*="flex h-8 w-10 items-center justify-center"]')).toContainText("2");

    await page.getByRole("button", { name: "Decrease quantity" }).click();
    await expect(page.locator('[class*="flex h-8 w-10 items-center justify-center"]')).toContainText("1");
  });

  test("remove item from cart", async ({ page }) => {
    await page.goto("/bouquets");
    await page.getByRole("button", { name: "Add to Cart" }).first().click();
    await page.goto("/cart");

    // Find and click the remove button
    const removeButton = page.getByRole("button", { name: /Remove.*from cart/ }).first();
    await removeButton.click();

    // Cart should be empty again
    await expect(page.locator("h2")).toContainText("Your cart is empty");
  });

  test("cart persists across page reload", async ({ page }) => {
    await page.goto("/bouquets");
    await page.getByRole("button", { name: "Add to Cart" }).first().click();
    await expect(page.locator("#cart-icon span")).toContainText("1");

    // Reload the page
    await page.reload();

    // Cart badge should still show "1" (localStorage persistence)
    await expect(page.locator("#cart-icon span")).toContainText("1");
  });
});
