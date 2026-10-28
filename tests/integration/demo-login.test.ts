import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

// Runs the real login routes under a staging configuration with the demo login switched on.
const CODE = "482915";
type Routes = {
  reqOtp: (phone: string, ip: string) => Promise<Response>;
  verify: (phone: string, code: string, ip: string) => Promise<Response>;
  me: (cookie: string) => Promise<Response>;
  close: () => Promise<void>;
};
let r: Routes;

beforeAll(async () => {
  vi.resetModules();
  vi.stubEnv("APP_ENV", "staging");
  vi.stubEnv("OTP_PROVIDER", "provider");
  vi.stubEnv("DEMO_LOGIN", "1");
  vi.stubEnv("DEMO_LOGIN_CODE", CODE);
  vi.stubEnv("SESSION_SECRET", "s".repeat(40));
  const [{ POST: rq }, { POST: vf }, { GET: meRoute }, helpers, client] = await Promise.all([
    import("@/app/api/auth/otp/request/route"),
    import("@/app/api/auth/otp/verify/route"),
    import("@/app/api/me/route"),
    import("../helpers"),
    import("@/db/client"),
  ]);
  const { makeRequest, ctx } = helpers;
  // Start from a clean throttle state: earlier test files also log in as these phones.
  await client.db.execute(sql`truncate table otp_challenges, rate_limit_hits`);
  r = {
    reqOtp: (phone, ip) => rq(makeRequest("/api/auth/otp/request", { body: { phone }, ip }), ctx),
    verify: (phone, code, ip) => vf(makeRequest("/api/auth/otp/verify", { body: { phone, code }, ip }), ctx),
    me: (cookie) => meRoute(makeRequest("/api/me", { method: "GET", cookie }), ctx),
    close: () => client.pool.end(),
  };
});
afterAll(async () => { await r?.close(); vi.unstubAllEnvs(); vi.resetModules(); });

describe("staging demo login through the real routes", () => {
  it("logs a demo customer in with the owner's code and gives the customer role", async () => {
    expect((await r.reqOtp("+919000000002", "10.77.0.1")).status).toBe(200);
    const res = await r.verify("+919000000002", CODE, "10.77.0.1");
    expect(res.status).toBe(200);
    const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
    expect(cookie).toMatch(/=/);
    const me = await (await r.me(cookie)).json();
    expect(JSON.stringify(me)).toMatch(/customer/);
    expect(JSON.stringify(me)).not.toMatch(/admin|merchant/);
  });
  it("rejects the well-known dev code", async () => {
    await r.reqOtp("+919000000003", "10.77.0.2");
    expect((await r.verify("+919000000003", "123456", "10.77.0.2")).status).toBeGreaterThanOrEqual(400);
  });
  it("refuses codes for the demo admin and merchant phones (fails closed with 503)", async () => {
    for (const [i, phone] of ["+919000000001", "+919000000004"].entries()) {
      const res = await r.reqOtp(phone, `10.77.1.${i}`);
      expect(res.status).toBe(503);
      expect((await res.json()).error?.code ?? "").toBe("otp_unavailable");
    }
  });
  it("refuses a real-looking number (no SMS vendor is wired)", async () => {
    expect((await r.reqOtp("+919876543210", "10.77.2.1")).status).toBe(503);
  });
});
