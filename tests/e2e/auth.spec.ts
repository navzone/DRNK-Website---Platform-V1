import { expect, test } from "@playwright/test";
import { loginViaUi } from "./helpers";

test("a user can log in with an OTP, see their account, log out, and is then locked out", async ({ page }) => {
  await loginViaUi(page);
  await expect(page).toHaveURL(/\/account/);
  await expect(page.getByRole("heading", { name: /Your account|Hi,/ })).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
});

test("a wrong code shows a safe error and no session", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Mobile number").fill("9000000999");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("Verification code").fill("000000");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toContainText("Invalid or expired code");
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
});

test("an invalid mobile number is rejected with a clear message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Mobile number").fill("12345");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("alert")).toContainText("valid Indian mobile number");
});

test("customers do not get the admin area", async ({ page }) => {
  await loginViaUi(page, undefined, "/admin");
  await expect(page.getByRole("heading", { name: "Admins only" })).toBeVisible();
});
