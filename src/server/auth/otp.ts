import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { env } from "@/lib/env";
import { hmacHex, safeEqual } from "@/lib/crypto";
import { badRequest, tooMany } from "@/lib/errors";
import { normalizeIndianPhone } from "@/lib/phone";
import { getOtpProvider } from "./otp-provider";
import { enforceRateLimit } from "./rate-limit";
import { createSession } from "./session";

export const OTP_CONFIG = {
  ttlMs: 5 * 60_000,
  maxAttempts: 5,
  resendMs: 30_000,
  requestPerPhone: { limit: 5, windowMs: 10 * 60_000 },
  requestPerIp: { limit: 20, windowMs: 10 * 60_000 },
  verifyPerPhone: { limit: 10, windowMs: 10 * 60_000 },
  verifyPerIp: { limit: 40, windowMs: 10 * 60_000 },
} as const;

const INVALID = () => badRequest("Invalid or expired code", "invalid_otp");
const codeHash = (phone: string, code: string) => hmacHex(`${phone}:${code}`, env().SESSION_SECRET);

export async function requestOtp(input: { phone: string; ip: string }) {
  const phone = normalizeIndianPhone(input.phone);
  if (!phone) throw badRequest("Enter a valid Indian mobile number", "invalid_phone");

  await enforceRateLimit(`otp-req:ip:${input.ip}`, OTP_CONFIG.requestPerIp.limit, OTP_CONFIG.requestPerIp.windowMs);
  await enforceRateLimit(`otp-req:phone:${phone}`, OTP_CONFIG.requestPerPhone.limit, OTP_CONFIG.requestPerPhone.windowMs);

  const [latest] = await db
    .select({ createdAt: schema.otpChallenges.createdAt })
    .from(schema.otpChallenges)
    .where(eq(schema.otpChallenges.phoneE164, phone))
    .orderBy(desc(schema.otpChallenges.createdAt))
    .limit(1);
  if (latest && Date.now() - latest.createdAt.getTime() < OTP_CONFIG.resendMs) {
    throw tooMany("Please wait a few seconds before requesting another code.");
  }

  const provider = getOtpProvider();
  const code = provider.generateCode(phone);
  const [challenge] = await db
    .insert(schema.otpChallenges)
    .values({ phoneE164: phone, codeHash: codeHash(phone, code), expiresAt: new Date(Date.now() + OTP_CONFIG.ttlMs) })
    .returning({ id: schema.otpChallenges.id });
  try {
    await provider.send(phone, code);
  } catch (err) {
    // Delivery failed: invalidate the challenge so an undelivered code can never be used.
    if (challenge) {
      await db.update(schema.otpChallenges).set({ consumedAt: new Date() }).where(eq(schema.otpChallenges.id, challenge.id));
    }
    throw err;
  }
  return { expiresInSeconds: OTP_CONFIG.ttlMs / 1000, resendAfterSeconds: OTP_CONFIG.resendMs / 1000 };
}

export async function verifyOtp(input: { phone: string; code: string; ip: string }) {
  const phone = normalizeIndianPhone(input.phone);
  if (!phone || !/^\d{6}$/.test(input.code)) throw INVALID();

  await enforceRateLimit(`otp-ver:ip:${input.ip}`, OTP_CONFIG.verifyPerIp.limit, OTP_CONFIG.verifyPerIp.windowMs);
  await enforceRateLimit(`otp-ver:phone:${phone}`, OTP_CONFIG.verifyPerPhone.limit, OTP_CONFIG.verifyPerPhone.windowMs);

  const [challenge] = await db
    .select()
    .from(schema.otpChallenges)
    .where(and(eq(schema.otpChallenges.phoneE164, phone), isNull(schema.otpChallenges.consumedAt)))
    .orderBy(desc(schema.otpChallenges.createdAt))
    .limit(1);
  if (!challenge || challenge.expiresAt.getTime() <= Date.now()) throw INVALID();

  // Count the attempt atomically before comparing, so parallel guesses cannot exceed the cap.
  const [attempt] = await db
    .update(schema.otpChallenges)
    .set({ attempts: sql`${schema.otpChallenges.attempts} + 1` })
    .where(
      and(
        eq(schema.otpChallenges.id, challenge.id),
        isNull(schema.otpChallenges.consumedAt),
        sql`${schema.otpChallenges.attempts} < ${OTP_CONFIG.maxAttempts}`,
      ),
    )
    .returning({ id: schema.otpChallenges.id });
  if (!attempt) throw INVALID();

  if (!safeEqual(challenge.codeHash, codeHash(phone, input.code))) throw INVALID();

  // Single-use: only one concurrent verifier can consume the challenge.
  const [consumed] = await db
    .update(schema.otpChallenges)
    .set({ consumedAt: new Date() })
    .where(and(eq(schema.otpChallenges.id, challenge.id), isNull(schema.otpChallenges.consumedAt)))
    .returning({ id: schema.otpChallenges.id });
  if (!consumed) throw INVALID();

  await db.insert(schema.users).values({ phoneE164: phone }).onConflictDoNothing();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.phoneE164, phone)).limit(1);
  if (!user || user.deletedAt) throw INVALID();

  const session = await createSession(user);
  return { user, session };
}
