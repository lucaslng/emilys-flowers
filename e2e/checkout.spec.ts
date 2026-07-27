import { test, expect } from "@playwright/test";

test.describe("Checkout flow", () => {
  test("checkout page with empty cart shows empty message", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.locator("h1")).toContainText("Your cart is empty");
  });

  test("checkout page shows Pay with Stripe button when cart has items", async ({ page }) => {
    await page.goto("/bouquets");
    await page.getByRole("button", { name: "Add to Cart" }).first().click();
    await page.goto("/checkout");

    await expect(page.getByRole("button", { name: "Pay with Stripe" })).toBeVisible();
    // Order summary should show the item
    await expect(page.locator("h2")).toContainText("Order Summary");
  });

  test("clicking Pay with Stripe redirects to success page and clears cart", async ({ page }) => {
    await page.goto("/bouquets");
    await page.getByRole("button", { name: "Add to Cart" }).first().click();
    await page.goto("/checkout");

    await page.getByRole("button", { name: "Pay with Stripe" }).click();

    // The webServer forces simulated checkout mode (see playwright.config.ts), so
    // /api/checkout returns /checkout/success?success=true&order=...&items=...
    await expect(page).toHaveURL(/\/checkout\/success/, { timeout: 15_000 });

    // Success page shows the thank-you heading
    await expect(page.locator("h1")).toContainText("Thank you for your order", { timeout: 5_000 });

    // The success page clears the cart on mount — confirm by visiting /cart
    await page.goto("/cart");
    await expect(page.locator("h2")).toContainText("Your cart is empty", { timeout: 5_000 });
  });

  test("POST /api/checkout with empty items returns 400", async ({ page }) => {
    const response = await page.request.post("/api/checkout", {
      data: { items: [] },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("No items provided");
  });

  test("POST /api/checkout with valid items returns url with success=true", async ({ page }) => {
    const response = await page.request.post("/api/checkout", {
      data: {
        items: [
          { id: "test-1", name: "Test Rose", price: 2499, quantity: 1 },
        ],
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.url).toContain("/checkout/success");
    expect(body.url).toContain("success=true");
  });
});
