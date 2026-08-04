import { test, expect } from "@playwright/test";

test.describe("Cart functionality", () => {
  test("empty cart shows empty state", async ({ page }) => {
    await page.goto("/cart");
    await expect(
      page.getByRole("heading", { name: "Your cart is empty" })
    ).toBeVisible();
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

    // Quantity shows "1" via the dedicated test id
    await expect(page.getByTestId("cart-item-quantity")).toContainText("1");

    // Proceed to Checkout visible
    await expect(page.getByRole("link", { name: "Proceed to Checkout" })).toBeVisible();
  });

  test("increase quantity works", async ({ page }) => {
    await page.goto("/bouquets");
    await page.getByRole("button", { name: "Add to Cart" }).first().click();
    await page.goto("/cart");

    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.getByTestId("cart-item-quantity")).toContainText("2");
  });

  test("decrease quantity works", async ({ page }) => {
    await page.goto("/bouquets");
    await page.getByRole("button", { name: "Add to Cart" }).first().click();
    await page.goto("/cart");

    // Increase to 2 first so decrease works
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.getByTestId("cart-item-quantity")).toContainText("2");

    await page.getByRole("button", { name: "Decrease quantity" }).click();
    await expect(page.getByTestId("cart-item-quantity")).toContainText("1");
  });

  test("remove item from cart", async ({ page }) => {
    await page.goto("/bouquets");
    await page.getByRole("button", { name: "Add to Cart" }).first().click();
    await page.goto("/cart");

    // Find and click the remove button
    const removeButton = page.getByRole("button", { name: /Remove.*from cart/ }).first();
    await removeButton.click();

    // Cart should be empty again
    await expect(
      page.getByRole("heading", { name: "Your cart is empty" })
    ).toBeVisible();
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

  test("corrupted stored cart degrades to an empty cart instead of NaN totals", async ({ page }) => {
    // Narrow edge case where seeding localStorage directly is clearer: a
    // structurally invalid stored cart (missing product fields) previously
    // hydrated as-is and produced $NaN totals. The sanitizer must drop it.
    await page.addInitScript(() => {
      localStorage.setItem(
        "emilys-flowers-cart",
        JSON.stringify([{ product: { id: "x", name: "Broken" }, quantity: 1 }])
      );
    });
    await page.goto("/cart");
    await expect(
      page.getByRole("heading", { name: "Your cart is empty" })
    ).toBeVisible({ timeout: 5_000 });
    // And no ghost line items rendered
    await expect(page.getByTestId("cart-item-quantity")).toHaveCount(0);
  });
});
