import { defineConfig, devices } from "@playwright/test";

// The product catalog is fetched from Stripe at build time, so the E2E build
// needs a test key (STRIPE_SECRET_KEY_TEST). The served app runs with an empty
// key so /api/checkout stays in simulated-success mode and never hits the real
// Stripe API. Next.js does not override an existing env var (even an empty one)
// with .env values, so the empty prefix on `start` forces `!secretKey` →
// simulated path.
const buildKey = process.env.STRIPE_SECRET_KEY_TEST ?? "";

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
    command: `STRIPE_SECRET_KEY=${buildKey} bun run build && STRIPE_SECRET_KEY= bun run start`,
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
