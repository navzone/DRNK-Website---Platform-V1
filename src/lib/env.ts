import { z } from "zod";

const schema = z.object({
  APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  APP_URL: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  OTP_PROVIDER: z.enum(["dev", "provider"]).default("dev"),
  SESSION_SECRET: z.string().min(32).default("dev-only-session-secret-change-me-0000000"),
  PAYMENT_PROVIDER: z.enum(["fake-sandbox", "razorpay"]).default("fake-sandbox"),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(""),
  CRON_SECRET: z.string().default(""),
  // Staging-only demo login. See src/server/auth/otp-provider.ts. Never allowed on production.
  DEMO_LOGIN: z.enum(["0", "1"]).default("0"),
  DEMO_LOGIN_CODE: z.string().default(""),
});

export type Env = z.infer<typeof schema>;

/** Parse and validate environment. Throws on unsafe production configuration. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const env = schema.parse(source);
  // The dev OTP adapter uses deterministic fixture codes. It may only run in development/test,
  // never on any internet-facing environment (staging included).
  if (env.OTP_PROVIDER === "dev" && env.APP_ENV !== "development" && env.APP_ENV !== "test") {
    throw new Error(`OTP_PROVIDER=dev is forbidden when APP_ENV=${env.APP_ENV}`);
  }
  if (env.DEMO_LOGIN === "1") {
    // Fixed-code login for two fictional customer phones. Only for a private staging check, never production.
    if (env.APP_ENV !== "staging") throw new Error(`DEMO_LOGIN=1 is only allowed when APP_ENV=staging (got ${env.APP_ENV})`);
    if (!/^\d{6}$/.test(env.DEMO_LOGIN_CODE) || env.DEMO_LOGIN_CODE === "123456") {
      throw new Error("DEMO_LOGIN_CODE must be a 6-digit code of your own choosing (not 123456) when DEMO_LOGIN=1");
    }
  }
  if (env.APP_ENV === "production") {
    if (env.PAYMENT_PROVIDER === "fake-sandbox") throw new Error("PAYMENT_PROVIDER=fake-sandbox is forbidden when APP_ENV=production");
    if (env.SESSION_SECRET.startsWith("dev-only")) throw new Error("SESSION_SECRET must be set to a real value in production");
  }
  if (env.APP_ENV === "staging" && env.SESSION_SECRET.startsWith("dev-only")) {
    throw new Error("SESSION_SECRET must be set to a real value in staging");
  }
  return env;
}

let cached: Env | undefined;
export function env(): Env {
  cached ??= loadEnv();
  return cached;
}
