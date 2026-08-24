import { test, expect } from "@playwright/test";
import { addFirstProductToCart, seedCart } from "./helpers";

test.describe("Cart functionality", () => {
  test("empty cart shows empty state", async ({ page }) => {
    await page.goto("/cart");
    await expect(
      page.getByRole("heading", { name: "Your cart is empty" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Shop Bouquets" })).toBeVisible();
  });

  test("add item to cart from bouquets page", async ({ page }) => {
    await addFirstProductToCart(page);
    await expect(page.locator("#cart-icon span")).toContainText("1");
  });

  test("cart displays added item with quantity controls", async ({ page }) => {
    await addFirstProductToCart(page);
    await page.goto("/cart");

    const removeButton = page.getByRole("button", { name: /Remove.*from cart/ }).first();
    await expect(removeButton).toBeVisible();

    await expect(page.getByTestId("cart-item-quantity")).toContainText("1");

    await expect(page.getByRole("link", { name: "Proceed to Checkout" })).toBeVisible();
  });

  test("increase quantity works", async ({ page }) => {
    await addFirstProductToCart(page);
    await page.goto("/cart");

    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.getByTestId("cart-item-quantity")).toContainText("2");
  });

  test("decrease quantity works", async ({ page }) => {
    await addFirstProductToCart(page);
    await page.goto("/cart");

    // Increase to 2 first so decrease works
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.getByTestId("cart-item-quantity")).toContainText("2");

    await page.getByRole("button", { name: "Decrease quantity" }).click();
    await expect(page.getByTestId("cart-item-quantity")).toContainText("1");
  });

  test("remove item from cart", async ({ page }) => {
    await addFirstProductToCart(page);
    await page.goto("/cart");

    const removeButton = page.getByRole("button", { name: /Remove.*from cart/ }).first();
    await removeButton.click();

    await expect(
      page.getByRole("heading", { name: "Your cart is empty" })
    ).toBeVisible();
  });

  test("cart persists across page reload", async ({ page }) => {
    await addFirstProductToCart(page);
    await expect(page.locator("#cart-icon span")).toContainText("1");

    await page.reload();

    await expect(page.locator("#cart-icon span")).toContainText("1");
  });

  test("corrupted stored cart degrades to an empty cart instead of NaN totals", async ({ page }) => {
    // Structurally invalid stored carts must be dropped by the sanitizer, not hydrated into $NaN totals.
    await seedCart(page, [{ product: { id: "x", name: "Broken" }, quantity: 1 }]);
    await page.goto("/cart");
    await expect(
      page.getByRole("heading", { name: "Your cart is empty" })
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("cart-item-quantity")).toHaveCount(0);
  });
});
