import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

// Runs once before the suite: applies real migrations to the dedicated test database.
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/drnk_test";
  if (!/drnk_test|_test(\b|$)/.test(url)) {
    throw new Error(`Refusing to run tests against a non-test database: ${new URL(url).pathname}`);
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await pool.end();
}
