import { ZodError } from "zod";
import { schema } from "@/db/client";
import { env } from "@/lib/env";
import { AppError, forbidden, unauthorized } from "@/lib/errors";
import { log } from "@/lib/log";
import { getSessionUser } from "@/server/auth/session";

export const SESSION_COOKIE = "drnk_session";

type User = typeof schema.users.$inferSelect;
type Role = User["role"];

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  const secure = env().APP_ENV === "development" || env().APP_ENV === "test" ? "" : "; Secure";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function clearSessionCookie(): string {
  return sessionCookie("", 0);
}

export function clientIp(req: Request): string {
  // Behind a trusted proxy the first x-forwarded-for entry is the client. See docs/DEPLOYMENT_RUNBOOK.md.
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** CSRF defence in depth (in addition to SameSite=Lax): state-changing requests must come from our own origin. */
export function assertSameOrigin(req: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const allowed = new URL(env().APP_URL).origin;
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const seen = origin ?? (referer ? new URL(referer).origin : null);
  if (seen !== allowed) throw forbidden("Cross-origin request rejected");
}

export async function authenticate(req: Request): Promise<User | null> {
  return getSessionUser(readCookie(req, SESSION_COOKIE));
}

export async function requireUser(req: Request): Promise<User> {
  const user = await authenticate(req);
  if (!user) throw unauthorized();
  return user;
}

export async function requireRole(req: Request, ...roles: Role[]): Promise<User> {
  const user = await requireUser(req);
  if (!roles.includes(user.role)) throw forbidden();
  return user;
}

export function json(data: unknown, init?: ResponseInit & { cookie?: string }): Response {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  if (init?.cookie) headers.append("Set-Cookie", init.cookie);
  return Response.json(data, { ...init, headers });
}

/** Wraps a handler: maps known errors to safe JSON, logs and masks unknown ones. */
export function handle(fn: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<Response> => {
    try {
      assertSameOrigin(req);
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof AppError) return json({ error: { code: err.code, message: err.message } }, { status: err.status });
      if (err instanceof ZodError) {
        return json({ error: { code: "validation_error", message: "Invalid input", issues: err.issues.map((i) => ({ path: i.path, message: i.message })) } }, { status: 400 });
      }
      log.error("unhandled_error", { path: new URL(req.url).pathname, err: err instanceof Error ? err.message : String(err) });
      return json({ error: { code: "internal_error", message: "Something went wrong" } }, { status: 500 });
    }
  };
}
