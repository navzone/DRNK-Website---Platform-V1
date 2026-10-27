import { expect, test } from "@playwright/test";
import { loginViaUi } from "./helpers";

test("book tickets, pay in the sandbox, and see a confirmed ticket", async ({ page }) => {
  await loginViaUi(page, undefined, "/events/demo-friday-night");
  await page.getByRole("button", { name: "Add one General ticket" }).click();
  await page.getByRole("button", { name: "Book tickets" }).click();
  await expect(page).toHaveURL(/\/bookings\/EVT-/);
  await expect(page.getByRole("heading", { name: "Waiting for payment" })).toBeVisible();
  await page.getByRole("button", { name: "Pay now" }).click();
  await expect(page.getByText("Sandbox payment started")).toBeVisible();
  // Still pending: the browser cannot confirm a payment by itself.
  await expect(page.getByRole("heading", { name: "Waiting for payment" })).toBeVisible();
  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await expect(page.getByRole("heading", { name: "Confirmed" })).toBeVisible();
  await expect(page.getByText(/TKT-/)).toBeVisible();
});

test("a failed sandbox payment never confirms the booking", async ({ page }) => {
  await loginViaUi(page, undefined, "/events/demo-friday-night");
  await page.getByRole("button", { name: "Add one General ticket" }).click();
  await page.getByRole("button", { name: "Book tickets" }).click();
  await page.getByRole("button", { name: "Pay now" }).click();
  await page.getByRole("button", { name: "Simulate failed payment" }).click();
  await expect(page.getByRole("heading", { name: "Waiting for payment" })).toBeVisible();
  await expect(page.getByText(/TKT-/)).toHaveCount(0);
});

test("cancelling an unpaid booking releases it", async ({ page }) => {
  await loginViaUi(page, undefined, "/events/demo-friday-night");
  await page.getByRole("button", { name: "Add one General ticket" }).click();
  await page.getByRole("button", { name: "Book tickets" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByRole("heading", { name: "Cancelled" })).toBeVisible();
});

test("reserve a table and place a dine-in order", async ({ page }) => {
  await loginViaUi(page, undefined, "/venues/demo-taproom");
  const slot = new Date(Date.now() + 3 * 86400_000 + Math.floor(Math.random() * 3600_000)).toISOString().slice(0, 16);
  await page.getByLabel("Date and time").fill(slot);
  await page.getByRole("button", { name: "Request reservation" }).click();
  await expect(page.getByText(/RSV-/)).toBeVisible();
  await page.getByRole("button", { name: "Add one Peri-peri fries" }).click();
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByText(/ORD-/)).toBeVisible();
});
