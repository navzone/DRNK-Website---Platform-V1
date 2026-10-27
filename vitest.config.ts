import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      APP_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/drnk_test",
      OTP_PROVIDER: "dev",
      PAYMENT_PROVIDER: "fake-sandbox",
      RAZORPAY_WEBHOOK_SECRET: "test_webhook_secret_not_real",
    },
  },
});
