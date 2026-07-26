import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html"], ["json", { outputFile: "test-results/e2e-report.json" }]] : [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Prefix STRIPE_SECRET_KEY= (empty) on both build and start so the checkout
    // route always runs in its simulated-success mode, even when a developer has
    // a real key in .env. Next.js does not override an existing env var (even an
    // empty one) with .env values, so this forces `!secretKey` → simulated path.
    // E2E must never hit the real Stripe API.
    command: "STRIPE_SECRET_KEY= bun run build && STRIPE_SECRET_KEY= bun run start",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
