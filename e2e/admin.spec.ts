import { test, expect } from "@playwright/test";

test.describe("Admin smoke", () => {
  test("sign-in gate renders when unauthenticated", async ({ page }) => {
    await page.goto("/admin/orders");

    await expect(page.getByRole("heading", { name: "Admin — Orders" })).toBeVisible();
    await expect(page.getByText("Sign in to review orders")).toBeVisible();
    const signIn = page.getByRole("link", { name: "Sign in with OIDC" });
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute("href", "/api/admin/login");
  });

  test("unauthenticated ship call returns 401", async ({ request }) => {
    const response = await request.post("/api/admin/orders/cs_test_smoke/ship", {
      headers: { "Content-Type": "application/json" },
      data: '{"estimatedShippingTime":"3-5 days"}',
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized." });
  });
});
