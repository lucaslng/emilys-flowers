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
  // CI shards write blob reports (blob-report/) that the `merge-reports` job
  // in .github/workflows/test.yml merges into the uploaded HTML report.
  reporter: process.env.CI ? [["blob"]] : [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    // Deterministic e2e: force reduced motion so the reduced-motion CSS guard
    // renders every reveal at full opacity immediately — scroll-triggered
    // animation timing starves on loaded CI runners (ScrollTrigger evaluates
    // on rAF ticks, which can all land after the page has scrolled back to
    // the top), leaving reveals invisible and settlePage polling forever.
    contextOptions: { reducedMotion: "reduce" },
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
