import { test, expect, type Page } from "@playwright/test";

// E2E never hits the real Stripe API. Both checkout network hops are
// intercepted with page.route():
//
//   - POST /api/checkout        → fulfilled with a success URL
//   - GET /api/checkout/session → fulfilled with a sanitized receipt fixture
//
// so the served app's runtime credentials are irrelevant. Route behavior
// itself (validation, catalog resolution, 503-when-unconfigured) is covered
// by unit tests in src/lib/__tests__/checkout-route.test.ts.

/** Sanitized projection shape returned by GET /api/checkout/session. */
const receiptFixture = {
  items: [{ name: "Aurora Bloom", quantity: 2, unitAmount: 7999 }],
  subtotal: 15998,
  shipping: 0,
  total: 15998,
  orderNumber: "EF-TEST",
};

const successUrl =
  "/checkout/success?success=true&order=EF-TEST&session_id=cs_test_123";

async function mockCheckoutApis(
  page: Page,
  session?: { status?: number; body?: object }
) {
  await page.route(/\/api\/checkout$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: successUrl }),
    })
  );
  await page.route(/\/api\/checkout\/session/, (route) =>
    route.fulfill({
      status: session?.status ?? 200,
      contentType: "application/json",
      body: JSON.stringify(session?.body ?? receiptFixture),
    })
  );
}

// A complete, valid delivery address is required before Pay submits
// (client-side validation blocks incomplete/invalid forms).
async function fillDeliveryAddress(page: Page) {
  await page.getByLabel("Full name").fill("Ava Bloom");
  await page.getByLabel("Street address").fill("12 Rose Lane");
  await page.getByLabel("City").fill("Toronto");
  await page.getByLabel("Province").selectOption("ON");
  await page.getByLabel("Postal code").fill("M5V 2T6");
}

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
    await expect(page.getByRole("heading", { name: "Order Summary" })).toBeVisible();
  });

  test("clicking Pay with Stripe redirects to success page and clears cart", async ({ page }) => {
    await mockCheckoutApis(page);
    await page.goto("/bouquets");
    await page.getByRole("button", { name: "Add to Cart" }).first().click();
    await page.goto("/checkout");

    await fillDeliveryAddress(page);
    await page.getByRole("button", { name: "Pay with Stripe" }).click();

    // The intercepted POST returns our success URL; the receipt comes from
    // the intercepted session-retrieval endpoint.
    await expect(page).toHaveURL(/\/checkout\/success/, { timeout: 15_000 });

    // Success page shows the thank-you heading and the retrieved receipt
    await expect(page.locator("h1")).toContainText("Thank you for your order", { timeout: 5_000 });
    await expect(page.getByText("Aurora Bloom")).toBeVisible();
    await expect(page.getByText("Free")).toBeVisible();

    // The success page clears the cart on mount — confirm by visiting /cart
    await page.goto("/cart");
    await expect(
      page.getByRole("heading", { name: "Your cart is empty" })
    ).toBeVisible({ timeout: 5_000 });
  });

  test("invalid postal code shows field errors and stays on checkout", async ({ page }) => {
    await page.goto("/bouquets");
    await page.getByRole("button", { name: "Add to Cart" }).first().click();
    await page.goto("/checkout");

    await page.getByLabel("Full name").fill("Ava Bloom");
    await page.getByLabel("Street address").fill("12 Rose Lane");
    await page.getByLabel("City").fill("Toronto");
    await page.getByLabel("Province").selectOption("ON");
    // Malformed postal code — correct format is A1A 1A1.
    await page.getByLabel("Postal code").fill("ABC");

    await page.getByRole("button", { name: "Pay with Stripe" }).click();

    // Submission is blocked client-side: no navigation happens, and the
    // invalid field gets an inline message plus a summary banner.
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(
      page.getByText("Enter a valid Canadian postal code")
    ).toBeVisible();
    await expect(
      page.getByText("Please check the highlighted delivery address fields.")
    ).toBeVisible();
  });

  test("success page renders the retrieved receipt", async ({ page }) => {
    await mockCheckoutApis(page);
    await page.goto(successUrl);

    await expect(page.locator("h1")).toContainText("Thank you for your order");
    await expect(page.getByRole("heading", { name: "Order Summary" })).toBeVisible();
    await expect(page.getByText("Aurora Bloom")).toBeVisible();
    // 2 x $79.99 = $159.98; free shipping at/above $50 → total $159.98.
    // The value appears in the line total, subtotal, and total rows.
    await expect(page.getByText("$159.98")).toHaveCount(3);
    await expect(page.getByText("Free")).toBeVisible();
  });

  test("success page shows no order summary when receipt retrieval fails", async ({ page }) => {
    await mockCheckoutApis(page, { status: 500 });
    await page.goto(successUrl);

    // Failures degrade to the generic confirmation without an order summary.
    await expect(page.locator("h1")).toContainText("Thank you for your order");
    await expect(page.getByRole("heading", { name: "Order Summary" })).toHaveCount(0);
  });
});
