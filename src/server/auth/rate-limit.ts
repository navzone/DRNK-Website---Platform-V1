import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { tooMany } from "@/lib/errors";

/** Sliding-window limiter backed by Postgres (shared across instances). Every attempt counts, even blocked ones. */
export async function enforceRateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  await db.insert(schema.rateLimitHits).values({ key });
  const since = new Date(Date.now() - windowMs);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.rateLimitHits)
    .where(and(eq(schema.rateLimitHits.key, key), gte(schema.rateLimitHits.createdAt, since)));
  if ((row?.count ?? 0) > limit) throw tooMany();
}
