import { describe, expect, it } from "vitest";
import { normalizeIndianPhone, maskPhone } from "@/lib/phone";
import { loadEnv } from "@/lib/env";
import { redact } from "@/lib/log";
import { randomOtp, randomRef, safeEqual, hmacHex } from "@/lib/crypto";

describe("phone normalization", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
  ])("accepts %s", (input, out) => expect(normalizeIndianPhone(input)).toBe(out));

  it.each(["", "12345", "5876543210", "+1 415 555 0100", "98765432100", "abcdefghij"])("rejects %s", (input) =>
    expect(normalizeIndianPhone(input)).toBeNull(),
  );

  it("masks the middle digits", () => expect(maskPhone("+919876543210")).toBe("+91******10"));
});

describe("environment safety", () => {
  const base = { DATABASE_URL: "postgres://x/y", SESSION_SECRET: "a".repeat(40) };
  it("forbids the dev OTP adapter in production and staging", () => {
    expect(() => loadEnv({ ...base, APP_ENV: "production", OTP_PROVIDER: "dev", PAYMENT_PROVIDER: "razorpay" })).toThrow(/OTP_PROVIDER=dev/);
    expect(() => loadEnv({ ...base, APP_ENV: "staging", OTP_PROVIDER: "dev" })).toThrow(/OTP_PROVIDER=dev/);
  });
  it("allows the dev OTP adapter in development and test", () => {
    expect(loadEnv({ ...base, APP_ENV: "development", OTP_PROVIDER: "dev" }).OTP_PROVIDER).toBe("dev");
    expect(loadEnv({ ...base, APP_ENV: "test", OTP_PROVIDER: "dev" }).OTP_PROVIDER).toBe("dev");
  });
  it("forbids the fake payment provider and default secret in production", () => {
    expect(() => loadEnv({ ...base, APP_ENV: "production", OTP_PROVIDER: "provider", PAYMENT_PROVIDER: "fake-sandbox" })).toThrow(/fake-sandbox/);
    expect(() => loadEnv({ DATABASE_URL: "x", APP_ENV: "production", OTP_PROVIDER: "provider", PAYMENT_PROVIDER: "razorpay" })).toThrow(/SESSION_SECRET/);
  });
  it("rejects a short session secret", () => {
    expect(() => loadEnv({ ...base, SESSION_SECRET: "short" })).toThrow();
  });
});

describe("logging redaction", () => {
  it("redacts sensitive keys, including nested ones", () => {
    const out = redact({ code: "123456", nested: { token: "abc", phone: "+91", ok: 1 } }) as Record<string, Record<string, unknown>>;
    expect(out.code).toBe("[redacted]");
    expect(out.nested?.token).toBe("[redacted]");
    expect(out.nested?.phone).toBe("[redacted]");
    expect(out.nested?.ok).toBe(1);
  });
});

describe("crypto helpers", () => {
  it("generates 6-digit OTPs", () => {
    for (let i = 0; i < 200; i++) expect(randomOtp()).toMatch(/^\d{6}$/);
  });
  it("generates prefixed references", () => expect(randomRef("EVT")).toMatch(/^EVT-[A-Z2-9]{8}$/));
  it("compares safely and hashes deterministically", () => {
    expect(safeEqual("a", "a")).toBe(true);
    expect(safeEqual("a", "b")).toBe(false);
    expect(safeEqual("a", "ab")).toBe(false);
    expect(hmacHex("x", "k")).toBe(hmacHex("x", "k"));
    expect(hmacHex("x", "k")).not.toBe(hmacHex("x", "k2"));
  });
});

describe("same-origin check", () => {
  const post = (url: string, headers: Record<string, string>) => new Request(url, { method: "POST", headers });
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  it("accepts the configured public URL", async () => {
    const { assertSameOrigin } = await import("@/server/api");
    expect(() => assertSameOrigin(post(`${appUrl}/api/x`, { origin: new URL(appUrl).origin }))).not.toThrow();
  });
  it("accepts the origin the request was actually sent to (a second domain alias)", async () => {
    const { assertSameOrigin } = await import("@/server/api");
    expect(() => assertSameOrigin(post("https://alias.example.com/api/x", { origin: "https://alias.example.com" }))).not.toThrow();
  });
  it("rejects another site, a missing origin, and a lookalike", async () => {
    const { assertSameOrigin } = await import("@/server/api");
    expect(() => assertSameOrigin(post("https://alias.example.com/api/x", { origin: "https://evil.example" }))).toThrow();
    expect(() => assertSameOrigin(post("https://alias.example.com/api/x", {}))).toThrow();
    expect(() => assertSameOrigin(post("https://alias.example.com/api/x", { origin: "https://alias.example.com.evil.example" }))).toThrow();
  });
  it("does not check safe methods", async () => {
    const { assertSameOrigin } = await import("@/server/api");
    expect(() => assertSameOrigin(new Request("https://alias.example.com/x", { method: "GET" }))).not.toThrow();
  });
});
