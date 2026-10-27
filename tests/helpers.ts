import { sql } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { seedDemo, DEMO_PHONES } from "@/db/seed-data";
import { devOutbox, DEV_FIXTURE_CODE } from "@/server/auth/otp-provider";

export { db, pool, DEMO_PHONES, DEV_FIXTURE_CODE, devOutbox };

export const ORIGIN = "http://localhost:3000";

export async function resetDb() {
  await db.execute(sql`
    DO $$ DECLARE r record; BEGIN
      FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;`);
  devOutbox.clear();
}

export async function resetAndSeed() {
  await resetDb();
  await seedDemo(db);
}

export async function closeDb() {
  await pool.end();
}

type ReqOpts = { method?: string; body?: unknown; cookie?: string; origin?: string | null; ip?: string };

export function makeRequest(path: string, opts: ReqOpts = {}): Request {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": opts.ip ?? "10.0.0.1" };
  if (opts.origin !== null) headers.origin = opts.origin ?? ORIGIN;
  if (opts.cookie) headers.cookie = opts.cookie;
  return new Request(`${ORIGIN}${path}`, {
    method: opts.method ?? "POST",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

export const ctx = { params: Promise.resolve({}) };

export function cookieFrom(res: Response): string {
  const set = res.headers.get("set-cookie") ?? "";
  return set.split(";")[0] ?? "";
}

/** Full login through the real route handlers using the dev adapter fixture code. */
export async function loginAs(phone: string, ip = "10.0.0.1") {
  const { POST: request } = await import("@/app/api/auth/otp/request/route");
  const { POST: verify } = await import("@/app/api/auth/otp/verify/route");
  const r1 = await request(makeRequest("/api/auth/otp/request", { body: { phone }, ip }), ctx);
  if (r1.status !== 200) throw new Error(`otp request failed: ${r1.status}`);
  const r2 = await verify(makeRequest("/api/auth/otp/verify", { body: { phone, code: DEV_FIXTURE_CODE }, ip }), ctx);
  if (r2.status !== 200) throw new Error(`otp verify failed: ${r2.status}`);
  return cookieFrom(r2);
}
