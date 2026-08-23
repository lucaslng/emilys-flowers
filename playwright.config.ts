import { defineConfig, devices } from "@playwright/test";

// E2E builds are pinned deterministic: FLOWERS_ENABLED/UNDER_CONSTRUCTION
// bypass next.config.ts's live Flagship evaluation, which would otherwise run
// whenever a developer's .env carries real credentials. The product catalog
// still needs STRIPE_SECRET_KEY at build time — taken from the invoking
// environment when exported (CI), otherwise left to Next.js's own `.env`
// loading (an empty `STRIPE_SECRET_KEY=` prefix would shadow `.env`; Next.js
// does not override existing vars, even empty ones). The served app never
// hits the real Stripe API: E2E specs intercept both checkout network hops
// with page.route() — POST /api/checkout and GET /api/checkout/session are
// fulfilled with fixtures — so runtime credentials are irrelevant.
const stripePrefix =
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
    command: `FLOWERS_ENABLED=true UNDER_CONSTRUCTION=false ${stripePrefix}bun run build && bun run start`,
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
