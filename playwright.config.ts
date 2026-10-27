import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// Optional: point at an already-installed Chromium (for sandboxes where `playwright install` cannot download).
const executablePath = process.env.E2E_CHROMIUM_PATH || undefined;
const launchOptions = executablePath ? { executablePath } : {};

// Requires a built app (`npm run build`), a migrated + seeded database, and the dev OTP / fake-sandbox adapters.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions } },
    { name: "tablet", use: { ...devices["iPad (gen 7)"], browserName: "chromium", launchOptions } },
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      APP_ENV: "development",
      APP_URL: `http://localhost:${PORT}`,
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/drnk_smoke",
      OTP_PROVIDER: "dev",
      PAYMENT_PROVIDER: "fake-sandbox",
      RAZORPAY_WEBHOOK_SECRET: "e2e_webhook_secret_not_real",
    },
  },
});
