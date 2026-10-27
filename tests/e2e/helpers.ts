import { expect, type Page } from "@playwright/test";

let counter = Math.floor(Math.random() * 400);
/** Fixture-prefixed numbers (+91900000xxxx) receive the dev OTP fixture code. Distinct per call to avoid OTP throttles. */
export function freshPhone(): string {
  counter = (counter + 1) % 900;
  return `9000000${String(100 + counter).padStart(3, "0")}`;
}

export async function loginViaUi(page: Page, phone = freshPhone(), next = "/account") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("Verification code").fill("123456");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return phone;
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
