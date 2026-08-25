import { defineConfig, devices } from "@playwright/test";

// Pinned deterministic build: FLOWERS_ENABLED/UNDER_CONSTRUCTION bypass live Flagship evaluation.
// An empty `STRIPE_SECRET_KEY=` would shadow `.env` (Next.js doesn't override existing vars), hence the conditional prefix.
const stripePrefix =
  typeof process.env.STRIPE_SECRET_KEY !== "undefined" &&
  process.env.STRIPE_SECRET_KEY !== ""
    ? `STRIPE_SECRET_KEY=${process.env.STRIPE_SECRET_KEY} `
    : "";

// Dummy admin env vars only arm the OIDC gate for the admin smoke spec —
// these tests never reach Stripe or the real IdP, so the values are inert.
// Prefixed onto both halves of the chain: `VAR=x a && b` only exports to `a`.
const adminEnvPrefix =
  "OIDC_ISSUER=https://accounts.example.com OIDC_CLIENT_ID=e2e-dummy-client OIDC_CLIENT_SECRET=e2e-dummy-secret ADMIN_SESSION_SECRET=e2e-dummy-session-secret-0123456789abcdef ADMIN_OIDC_GROUPS=e2e-admins BASE_URL=http://localhost:3000 ";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CI shards write blob reports that test.yml's merge-reports job merges into the HTML report.
  reporter: process.env.CI ? [["blob"]] : [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    // Reduced motion renders every reveal at full opacity immediately — scroll-triggered animation timing starves on loaded CI runners.
    contextOptions: { reducedMotion: "reduce" },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `${adminEnvPrefix}FLOWERS_ENABLED=true UNDER_CONSTRUCTION=false ${stripePrefix}bun run build && ${adminEnvPrefix}bun run start`,
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
