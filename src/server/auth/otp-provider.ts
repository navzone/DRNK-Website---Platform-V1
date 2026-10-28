import { env } from "@/lib/env";
import { randomOtp } from "@/lib/crypto";
import { AppError } from "@/lib/errors";

export interface OtpProvider {
  generateCode(phoneE164: string): string;
  send(phoneE164: string, code: string): Promise<void>;
}

/** Test-visible record of codes "sent" by the dev adapter. Only populated by DevOtpProvider. */
export const devOutbox = new Map<string, string>();

const FIXTURE_PREFIX = "+91900000";
export const DEV_FIXTURE_CODE = "123456";

/**
 * Development/test-only adapter. Demo fixture phones (+91900000xxxx) always get DEV_FIXTURE_CODE;
 * any other number gets a random code that is only retrievable via devOutbox.
 * The constructor and loadEnv() both refuse to run outside development/test.
 */
export class DevOtpProvider implements OtpProvider {
  constructor() {
    const appEnv = env().APP_ENV;
    if (appEnv !== "development" && appEnv !== "test") {
      throw new Error(`DevOtpProvider cannot be used when APP_ENV=${appEnv}`);
    }
  }
  generateCode(phoneE164: string) {
    return phoneE164.startsWith(FIXTURE_PREFIX) ? DEV_FIXTURE_CODE : randomOtp();
  }
  async send(phoneE164: string, code: string) {
    devOutbox.set(phoneE164, code);
  }
}

/**
 * Real SMS/OTP provider boundary. NOT WIRED: no provider has been chosen or configured.
 * It fails closed — it never pretends a code was delivered.
 */
export class ConfiguredOtpProvider implements OtpProvider {
  generateCode() {
    return randomOtp();
  }
  async send(): Promise<void> {
    throw new AppError(503, "otp_unavailable", "Verification is temporarily unavailable. Please try again later.");
  }
}

/** The only phones the staging demo login accepts: the two fictional demo customers. Never admin or merchant. */
export const DEMO_LOGIN_PHONES: readonly string[] = ["+919000000002", "+919000000003"];

/**
 * Staging-only: lets a private tester log in as a fictional demo customer with a code the owner chose
 * (DEMO_LOGIN_CODE) instead of an SMS. Any other phone falls through to the real provider, which is not wired
 * and fails closed. loadEnv() and this constructor both refuse it outside APP_ENV=staging.
 */
export class DemoLoginProvider extends ConfiguredOtpProvider {
  constructor() {
    super();
    const e = env();
    if (e.APP_ENV !== "staging" || e.DEMO_LOGIN !== "1") throw new Error("DemoLoginProvider is only available when APP_ENV=staging and DEMO_LOGIN=1");
  }
  override generateCode(phoneE164?: string) {
    return phoneE164 && DEMO_LOGIN_PHONES.includes(phoneE164) ? env().DEMO_LOGIN_CODE : randomOtp();
  }
  override async send(phoneE164?: string): Promise<void> {
    if (phoneE164 && DEMO_LOGIN_PHONES.includes(phoneE164)) return; // nothing is sent; the code is known to the owner
    return super.send();
  }
}

export function getOtpProvider(): OtpProvider {
  const e = env();
  if (e.OTP_PROVIDER === "dev") return new DevOtpProvider();
  return e.DEMO_LOGIN === "1" ? new DemoLoginProvider() : new ConfiguredOtpProvider();
}
