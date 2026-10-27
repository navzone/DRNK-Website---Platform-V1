export {};

const appEnv = process.env.APP_ENV ?? "development";
if (appEnv === "production") {
  console.error("Refusing to seed demo data when APP_ENV=production");
  process.exit(1);
}

const { db, pool } = await import("../src/db/client");
const { seedDemo } = await import("../src/db/seed-data");
await seedDemo(db);
await pool.end();
console.log("demo seed complete");
