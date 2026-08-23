import { defineConfig, devices } from "@playwright/test";

// The product catalog is fetched from Stripe at build time, so the E2E build
// needs a key (STRIPE_SECRET_KEY): taken from the invoking environment when
// exported (CI), otherwise left to Next.js's own `.env` loading. The prefix
// must be omitted entirely when absent — an empty `STRIPE_SECRET_KEY=` would
// shadow `.env` (Next.js does not override existing vars, even empty ones).
// The served app never hits the real Stripe API: E2E specs intercept both
// checkout network hops with page.route() — POST /api/checkout and
// GET /api/checkout/session are fulfilled with fixtures — so runtime
// credentials are irrelevant.
const buildPrefix =
  process.env.STRIPE_SECRET_KEY !== undefined
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
    command: `${buildPrefix}bun run build && bun run start`,
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
