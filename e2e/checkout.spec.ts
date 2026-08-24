import { test, expect, type Page } from "@playwright/test";

// No real Stripe calls: both checkout network hops are intercepted below with
// page.route(). Route behavior itself is covered by unit tests in
// src/lib/__tests__/checkout-route.test.ts.

/** Sanitized projection shape returned by GET /api/checkout/session. */
const receiptFixture = {
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

const successUrl =
  "/checkout/success?order=EF-TEST&session_id=cs_test_123";

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

// Complete, valid address — client-side validation blocks Pay otherwise.
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
    await expect(page.getByRole("heading", { name: "Order Summary" })).toBeVisible();
  });

  test("clicking Pay with Stripe redirects to success page and clears cart", async ({ page }) => {
    await mockCheckoutApis(page);
    await page.goto("/bouquets");
    await page.getByRole("button", { name: "Add to Cart" }).first().click();
    await page.goto("/checkout");

    await fillDeliveryAddress(page);
    await page.getByRole("checkbox", { name: /I agree/i }).check();
    await page.getByRole("button", { name: "Pay with Stripe" }).click();

    await expect(page).toHaveURL(/\/checkout\/success/, { timeout: 15_000 });

    await expect(page.locator("h1")).toContainText("Thank you for your order", { timeout: 5_000 });
    await expect(page.getByText("Aurora Bloom")).toBeVisible();
    await expect(page.getByText("Free")).toBeVisible();

    // Cart clearing happens on the success page mount.
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
    // Blur first: revealing the postal error shifts layout and swallows the click.
    await page.getByLabel("Postal code").blur();

    await page.getByRole("checkbox", { name: /I agree/i }).check();
    await page.getByRole("button", { name: "Pay with Stripe" }).click();

    // Client-side validation blocks submission before any fetch, so the
    // server-error banner never appears here.
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(
      page.getByText("Enter a valid Canadian postal code")
    ).toBeVisible();
  });

  test("submission is blocked while terms are not accepted", async ({ page }) => {
    let checkoutCalled = false;
    await page.route(/\/api\/checkout$/, (route) => {
      checkoutCalled = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: successUrl }),
      });
    });
    await page.route(/\/api\/checkout\/session/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(receiptFixture),
      })
    );

    await page.goto("/bouquets");
    await page.getByRole("button", { name: "Add to Cart" }).first().click();
    await page.goto("/checkout");

    await fillDeliveryAddress(page);
    await page.getByRole("button", { name: "Pay with Stripe" }).click();

    const agreementError = page.getByText(
      "Please agree to the Terms of Service and Privacy Policy before paying."
    );
    await expect(agreementError).toBeVisible();

    // Prove the block holds: no navigation and no fetch after a settle window.
    await page.waitForTimeout(1_000);
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(agreementError).toBeVisible();
    expect(checkoutCalled).toBe(false);
  });

  test("success page renders the retrieved receipt", async ({ page }) => {
    await mockCheckoutApis(page);
    await page.goto(successUrl);

    await expect(page.locator("h1")).toContainText("Thank you for your order");
    await expect(page.getByRole("heading", { name: "Order Summary" })).toBeVisible();
    await expect(page.getByText("Aurora Bloom")).toBeVisible();
    await expect(page.locator("img[src='/products/green-evangeline/01-main.jpg']")).toHaveCount(1);
    // $159.98 appears 3×: line total, subtotal, total.
    await expect(page.getByText("$159.98")).toHaveCount(3);
    await expect(page.getByText("Free")).toBeVisible();
  });

  test("success page shows no order summary when receipt retrieval fails", async ({ page }) => {
    await mockCheckoutApis(page, { status: 500 });
    await page.goto(successUrl);

    await expect(page.locator("h1")).toContainText("Thank you for your order");
    await expect(page.getByRole("heading", { name: "Order Summary" })).toHaveCount(0);
  });
});
