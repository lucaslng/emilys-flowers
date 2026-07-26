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
    command: "bun run build && bun run start",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
