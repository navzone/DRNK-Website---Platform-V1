export {};

const appEnv = process.env.APP_ENV ?? "development";
if (appEnv === "production") {
  console.error("Refusing to seed demo data when APP_ENV=production");
  process.exit(1);
}

const { db, pool } = await import("../src/db/client");
const { seedDemo } = await import("../src/db/seed-data");
// Demo accounts (including an admin) use fixture phone numbers. Create them only where the dev OTP adapter is active,
// or when explicitly requested. On staging with real SMS, seed public content only.
const withUsers = appEnv === "development" || appEnv === "test" || process.env.SEED_DEMO_USERS === "1";
await seedDemo(db, { withUsers });
console.log(withUsers ? "demo accounts: created" : "demo accounts: skipped");
await pool.end();
console.log("demo seed complete");
