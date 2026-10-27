import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { schema } from "@/db/client";
import { POST as requestOtpRoute } from "@/app/api/auth/otp/request/route";
import { POST as verifyOtpRoute } from "@/app/api/auth/otp/verify/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { GET as meRoute } from "@/app/api/me/route";
import { OTP_CONFIG } from "@/server/auth/otp";
import {
  closeDb, cookieFrom, ctx, db, DEMO_PHONES, DEV_FIXTURE_CODE, loginAs, makeRequest, resetAndSeed,
} from "../helpers";

const P1 = DEMO_PHONES.customer;
const P2 = DEMO_PHONES.customer2;
const reqOtp = (phone: string, ip = "10.0.0.1") => requestOtpRoute(makeRequest("/api/auth/otp/request", { body: { phone }, ip }), ctx);
const verify = (phone: string, code: string, ip = "10.0.0.1") => verifyOtpRoute(makeRequest("/api/auth/otp/verify", { body: { phone, code }, ip }), ctx);
const me = (cookie?: string) => meRoute(makeRequest("/api/me", { method: "GET", cookie }), ctx);

beforeEach(resetAndSeed);
afterAll(closeDb);

describe("OTP login", () => {
  it("logs in with a valid code and sets a hardened session cookie", async () => {
    expect((await reqOtp(P1)).status).toBe(200);
    const res = await verify(P1, DEV_FIXTURE_CODE);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain(cookieFrom(res).split("=")[1] ?? "never");
    expect(body.user.role).toBe("customer");
    expect((await me(cookieFrom(res))).status).toBe(200);
  });

  it("creates a new customer account on first login", async () => {
    const fresh = "+919876543210";
    await reqOtp(fresh);
    const res = await verify(fresh, (await import("@/server/auth/otp-provider")).devOutbox.get(fresh)!);
    expect(res.status).toBe(200);
    const [u] = await db.select().from(schema.users).where(eq(schema.users.phoneE164, fresh));
    expect(u?.role).toBe("customer");
  });

  it("rejects an invalid code with a generic error", async () => {
    await reqOtp(P1);
    const res = await verify(P1, "000000");
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_otp");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("rejects an expired code", async () => {
    await reqOtp(P1);
    await db.update(schema.otpChallenges).set({ expiresAt: new Date(Date.now() - 1000) });
    const res = await verify(P1, DEV_FIXTURE_CODE);
    expect(res.status).toBe(400);
  });

  it("rejects a malformed phone and a malformed code", async () => {
    expect((await reqOtp("12345")).status).toBe(400);
    await reqOtp(P1);
    expect((await verify(P1, "12ab56")).status).toBe(400);
  });

  it("locks the challenge after max wrong attempts, even if the right code follows", async () => {
    await reqOtp(P1);
    for (let i = 0; i < OTP_CONFIG.maxAttempts; i++) expect((await verify(P1, "999999", `10.1.0.${i}`)).status).toBe(400);
    expect((await verify(P1, DEV_FIXTURE_CODE, "10.1.1.1")).status).toBe(400);
  });

  it("a code is single-use", async () => {
    await reqOtp(P1);
    expect((await verify(P1, DEV_FIXTURE_CODE)).status).toBe(200);
    expect((await verify(P1, DEV_FIXTURE_CODE)).status).toBe(400);
  });

  it("concurrent verification of one code yields exactly one session", async () => {
    await reqOtp(P1);
    const results = await Promise.all(Array.from({ length: 5 }, () => verify(P1, DEV_FIXTURE_CODE)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    const sessions = await db.select().from(schema.sessions);
    expect(sessions).toHaveLength(1);
  });
});

describe("throttling and abuse protection", () => {
  it("throttles an immediate resend", async () => {
    expect((await reqOtp(P1)).status).toBe(200);
    const again = await reqOtp(P1);
    expect(again.status).toBe(429);
  });

  it("rate limits OTP requests per phone across time", async () => {
    let limited = 0;
    for (let i = 0; i < OTP_CONFIG.requestPerPhone.limit + 2; i++) {
      await db.update(schema.otpChallenges).set({ createdAt: new Date(Date.now() - 60_000) });
      const res = await reqOtp(P1, `10.2.0.${i}`);
      if (res.status === 429) limited++;
    }
    expect(limited).toBeGreaterThan(0);
  });

  it("rate limits OTP requests per IP", async () => {
    let limited = 0;
    for (let i = 0; i < OTP_CONFIG.requestPerIp.limit + 3; i++) {
      const phone = `+9198765${String(10000 + i)}`;
      if ((await reqOtp(phone, "10.9.9.9")).status === 429) limited++;
    }
    expect(limited).toBeGreaterThan(0);
  });
});

describe("sessions", () => {
  it("rejects requests with no cookie, a garbage cookie, and a revoked session", async () => {
    expect((await me()).status).toBe(401);
    expect((await me("drnk_session=garbage")).status).toBe(401);
    const cookie = await loginAs(P1);
    expect((await me(cookie)).status).toBe(200);
    const out = await logoutRoute(makeRequest("/api/auth/logout", { cookie }), ctx);
    expect(out.status).toBe(200);
    expect(out.headers.get("set-cookie")).toMatch(/Max-Age=0/);
    expect((await me(cookie)).status).toBe(401); // revoked token cannot be reused
  });

  it("rejects an expired session", async () => {
    const cookie = await loginAs(P1);
    await db.update(schema.sessions).set({ expiresAt: new Date(Date.now() - 1000) });
    expect((await me(cookie)).status).toBe(401);
  });

  it("rejects the session of a deleted account", async () => {
    const cookie = await loginAs(P1);
    await db.update(schema.users).set({ deletedAt: new Date() }).where(eq(schema.users.phoneE164, P1));
    expect((await me(cookie)).status).toBe(401);
  });

  it("isolates accounts: each cookie resolves only to its own user", async () => {
    const c1 = await loginAs(P1, "10.0.1.1");
    const c2 = await loginAs(P2, "10.0.1.2");
    const u1 = (await (await me(c1)).json()).user;
    const u2 = (await (await me(c2)).json()).user;
    expect(u1.id).not.toBe(u2.id);
  });

  it("stores only a hash of the session token", async () => {
    const cookie = await loginAs(P1);
    const token = decodeURIComponent(cookie.split("=")[1] ?? "");
    const rows = await db.select().from(schema.sessions);
    expect(rows[0]?.tokenHash).not.toBe(token);
    expect(rows[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("admin sessions have a shorter lifetime than customer sessions", async () => {
    await loginAs(DEMO_PHONES.admin, "10.0.2.1");
    await loginAs(P1, "10.0.2.2");
    const rows = await db.select({ role: schema.users.role, exp: schema.sessions.expiresAt })
      .from(schema.sessions).innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId));
    const admin = rows.find((r) => r.role === "admin")!;
    const cust = rows.find((r) => r.role === "customer")!;
    expect(admin.exp.getTime()).toBeLessThan(cust.exp.getTime());
  });
});

describe("CSRF origin check", () => {
  it("rejects state-changing requests from a foreign origin", async () => {
    const res = await requestOtpRoute(makeRequest("/api/auth/otp/request", { body: { phone: P1 }, origin: "https://evil.example" }), ctx);
    expect(res.status).toBe(403);
  });
  it("rejects state-changing requests with no Origin or Referer", async () => {
    const res = await requestOtpRoute(makeRequest("/api/auth/otp/request", { body: { phone: P1 }, origin: null }), ctx);
    expect(res.status).toBe(403);
  });
});

describe("append-only ledgers and DB invariants", () => {
  it("blocks UPDATE and DELETE on the points ledger and audit log", async () => {
    const [u] = await db.select().from(schema.users).limit(1);
    await db.insert(schema.pointsLedger).values({ userId: u!.id, delta: 10, kind: "adjustment", reason: "test", idempotencyKey: "t-1" });
    await expect(db.execute(sql`update points_ledger set delta = 999`)).rejects.toThrow();
    await expect(db.execute(sql`delete from points_ledger`)).rejects.toThrow();
    await db.insert(schema.auditEvents).values({ action: "test" });
    await expect(db.execute(sql`delete from audit_events`)).rejects.toThrow();
  });

  it("ledger idempotency key is unique", async () => {
    const [u] = await db.select().from(schema.users).limit(1);
    const row = { userId: u!.id, delta: 5, kind: "earn" as const, reason: "r", idempotencyKey: "dup" };
    await db.insert(schema.pointsLedger).values(row);
    await expect(db.insert(schema.pointsLedger).values(row)).rejects.toThrow();
  });

  it("the database itself refuses to oversell a ticket type", async () => {
    const [t] = await db.select().from(schema.ticketTypes).where(eq(schema.ticketTypes.name, "Limited"));
    await expect(db.update(schema.ticketTypes).set({ sold: t!.capacity + 1 }).where(eq(schema.ticketTypes.id, t!.id))).rejects.toThrow();
  });
});
