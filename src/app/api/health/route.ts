import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { buildId } from "@/lib/build-info";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

/** Why a check failed, for everything except production. Never includes secrets: only setting names, messages
 *  written by this app, and the database error code (for example ENOTFOUND or 28P01). */
function reason(kind: "config" | "database", err: unknown): Record<string, string> {
  if (process.env.APP_ENV === "production") return {};
  if (kind === "config") {
    const issues = (err as { issues?: { path: (string | number)[]; message: string }[] }).issues;
    const detail = issues?.length
      ? issues.map((i) => `${i.path.join(".") || "env"}: ${i.message}`).join("; ")
      : err instanceof Error ? err.message : "invalid settings";
    return { reason: "config", detail: detail.slice(0, 300) };
  }
  const code = (err as { code?: unknown }).code;
  return { reason: "database", detail: typeof code === "string" ? code.slice(0, 40) : "unreachable" };
}

export async function GET() {
  try {
    env(); // validates settings; an invalid setting must not be reported as a database outage
  } catch (err) {
    return Response.json({ status: "degraded", db: "down", build: buildId(), ...reason("config", err) }, { status: 503, headers });
  }
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok", db: "ok", build: buildId() }, { headers });
  } catch (err) {
    return Response.json({ status: "degraded", db: "down", build: buildId(), ...reason("database", err) }, { status: 503, headers });
  }
}
