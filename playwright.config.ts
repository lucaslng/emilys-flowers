import { defineConfig, devices } from "@playwright/test";

// Pinned deterministic build: FLOWERS_ENABLED/UNDER_CONSTRUCTION bypass the
// live Flagship evaluation. The Stripe key prefix is conditional — an empty
// `STRIPE_SECRET_KEY=` would shadow `.env` (Next.js doesn't override existing
// vars). Specs intercept both checkout APIs via page.route(): no real calls.
const stripePrefix =
  process.env.STRIPE_SECRET_KEY !== undefined &&
  process.env.STRIPE_SECRET_KEY !== ""
    ? `STRIPE_SECRET_KEY=${process.env.STRIPE_SECRET_KEY} `
    : "";

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
    command: `FLOWERS_ENABLED=true UNDER_CONSTRUCTION=false ${stripePrefix}bun run build && bun run start`,
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
