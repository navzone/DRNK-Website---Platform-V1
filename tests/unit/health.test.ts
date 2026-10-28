import { afterEach, describe, expect, it, vi } from "vitest";

async function health(envOverrides: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(envOverrides)) vi.stubEnv(k, v as string);
  const { GET } = await import("@/app/api/health/route");
  const res = await GET();
  return { status: res.status, body: (await res.json()) as Record<string, string> };
}

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/health", () => {
  it("names the bad setting when the configuration is invalid (not a database outage)", async () => {
    const r = await health({ APP_ENV: "development", DEMO_LOGIN: "1", DEMO_LOGIN_CODE: "482915" });
    expect(r.status).toBe(503);
    expect(r.body.db).toBe("down");
    expect(r.body.reason).toBe("config");
    expect(r.body.detail).toContain("DEMO_LOGIN=1 is only allowed when APP_ENV=staging");
  });

  it("lists every invalid setting at once", async () => {
    const r = await health({ APP_ENV: "staging", OTP_PROVIDER: "dev", DEMO_LOGIN: "1", DEMO_LOGIN_CODE: "123456", SESSION_SECRET: "dev-only-session-secret-change-me-0000000" });
    expect(r.body.reason).toBe("config");
    for (const name of ["OTP_PROVIDER=dev", "DEMO_LOGIN_CODE", "SESSION_SECRET"]) expect(r.body.detail).toContain(name);
  });

  it("reports only the error code when the database cannot be reached, never the connection string", async () => {
    const r = await health({ APP_ENV: "development", DEMO_LOGIN: "0", DATABASE_URL: "postgres://user:s3cretpw@nonexistent.invalid:5432/x" });
    expect(r.status).toBe(503);
    expect(r.body.reason).toBe("database");
    expect(JSON.stringify(r.body)).not.toContain("s3cretpw");
    expect(JSON.stringify(r.body)).not.toContain("nonexistent");
  });

  it("gives no failure detail on production", async () => {
    const r = await health({ APP_ENV: "production", OTP_PROVIDER: "provider", PAYMENT_PROVIDER: "fake-sandbox" });
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ status: "degraded", db: "down" });
  });
});
