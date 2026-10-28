import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { buildId } from "@/lib/build-info";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok", db: "ok", build: buildId() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "degraded", db: "down", build: buildId() }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
