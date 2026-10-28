import { afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeDb, db, pool } from "../helpers";

afterAll(closeDb);

const dropOtherConnections = () =>
  pool.query("select pg_terminate_backend(pid) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid()");
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("database connection loss (what a serverless host does to idle connections)", () => {
  it("does not crash the process and the next queries still succeed", async () => {
    // Open several pooled connections, then have the database drop them while they sit idle.
    await Promise.all([1, 2, 3].map(() => db.execute(sql`select pg_sleep(0.05)`)));
    await dropOtherConnections();
    await wait(300);
    const results = await Promise.all([1, 2, 3, 4].map(async (n) => (await db.execute(sql`select ${n}::int as n`)).rows[0]));
    expect(results.map((r) => r?.n)).toEqual([1, 2, 3, 4]);
  });

  it("recovers a transaction after the connections were dropped", async () => {
    await db.execute(sql`select 1`);
    await dropOtherConnections();
    await wait(300);
    const out = await db.transaction(async (tx) => (await tx.execute(sql`select 42::int as n`)).rows[0]);
    expect(out?.n).toBe(42);
  });

  it("checks a connection that sat idle for a while before reusing it", async () => {
    await db.execute(sql`select 1`);
    await wait(2_300); // longer than the staleness window, so the next checkout runs the cheap health check first
    const out = await db.execute(sql`select 7::int as n`);
    expect(out.rows[0]?.n).toBe(7);
  }, 15_000);
});
