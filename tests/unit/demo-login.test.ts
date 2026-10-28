import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadEnv } from "@/lib/env";

const base = { DATABASE_URL: "postgres://x/y", SESSION_SECRET: "a".repeat(40), OTP_PROVIDER: "provider" };

describe("demo login environment rules", () => {
  it("is off by default", () => {
    expect(loadEnv({ ...base, APP_ENV: "staging" }).DEMO_LOGIN).toBe("0");
  });
  it("is refused on production, development and test", () => {
    for (const APP_ENV of ["production", "development", "test"]) {
      expect(() => loadEnv({ ...base, APP_ENV, PAYMENT_PROVIDER: "razorpay", DEMO_LOGIN: "1", DEMO_LOGIN_CODE: "482915" })).toThrow(/DEMO_LOGIN=1 is only allowed/);
    }
  });
  it("needs a 6-digit code of the owner's choosing", () => {
    for (const code of ["", "12345", "abcdef", "123456", "4829150"]) {
      expect(() => loadEnv({ ...base, APP_ENV: "staging", DEMO_LOGIN: "1", DEMO_LOGIN_CODE: code })).toThrow(/DEMO_LOGIN_CODE/);
    }
  });
  it("is accepted on staging with a proper code", () => {
    expect(loadEnv({ ...base, APP_ENV: "staging", DEMO_LOGIN: "1", DEMO_LOGIN_CODE: "482915" }).DEMO_LOGIN).toBe("1");
  });
});

describe("demo login provider", () => {
  const stage = { APP_ENV: "staging", OTP_PROVIDER: "provider", DEMO_LOGIN: "1", DEMO_LOGIN_CODE: "482915", SESSION_SECRET: "s".repeat(40) };
  beforeEach(() => { vi.resetModules(); for (const [k, v] of Object.entries(stage)) vi.stubEnv(k, v); });
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it("serves the owner's code for the demo customers and the demo merchant only", async () => {
    const m = await import("@/server/auth/otp-provider");
    const p = m.getOtpProvider();
    expect(p).toBeInstanceOf(m.DemoLoginProvider);
    for (const phone of m.DEMO_LOGIN_PHONES) {
      expect(p.generateCode(phone)).toBe("482915");
      await expect(p.send(phone, "482915")).resolves.toBeUndefined();
    }
  });
  it("covers the demo customers and merchant, never the demo admin or any real number", async () => {
    const m = await import("@/server/auth/otp-provider");
    expect([...m.DEMO_LOGIN_PHONES].sort()).toEqual(["+919000000002", "+919000000003", "+919000000004"]);
    const p = m.getOtpProvider();
    for (const phone of ["+919000000001", "+919876543210"]) {
      expect(m.DEMO_LOGIN_PHONES).not.toContain(phone);
      expect(p.generateCode(phone)).toMatch(/^\d{6}$/);
      await expect(p.send(phone, "000000")).rejects.toMatchObject({ code: "otp_unavailable", status: 503 });
    }
  });
  it("falls back to the fail-closed provider when the flag is off", async () => {
    vi.stubEnv("DEMO_LOGIN", "0");
    const m = await import("@/server/auth/otp-provider");
    expect(m.getOtpProvider()).toBeInstanceOf(m.ConfiguredOtpProvider);
    expect(m.getOtpProvider()).not.toBeInstanceOf(m.DemoLoginProvider);
  });
  it("cannot be constructed outside staging", async () => {
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("OTP_PROVIDER", "dev");
    vi.stubEnv("DEMO_LOGIN", "0");
    const m = await import("@/server/auth/otp-provider");
    expect(() => new m.DemoLoginProvider()).toThrow(/only available when APP_ENV=staging/);
  });
});
