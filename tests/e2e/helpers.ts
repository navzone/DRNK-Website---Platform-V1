import { expect, type Page } from "@playwright/test";

let counter = Math.floor(Math.random() * 400);
/** Fixture-prefixed numbers (+91900000xxxx) receive the dev OTP fixture code. Distinct per call to avoid OTP throttles. */
export function freshPhone(): string {
  counter = (counter + 1) % 900;
  return `9000000${String(100 + counter).padStart(3, "0")}`;
}

let ipCounter = Math.floor(Math.random() * 200);
/** The app rate-limits OTP requests per client IP (20 per 10 min). Give each browser context its own address. */
export async function freshClientIp(page: Page) {
  ipCounter = (ipCounter + 1) % 250;
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `10.77.${Math.floor(Math.random() * 250)}.${ipCounter + 1}` });
}

export async function loginViaUi(page: Page, phone = freshPhone(), next = "/account") {
  await freshClientIp(page);
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Mobile number", { exact: true }).fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("Verification code", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return phone;
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
