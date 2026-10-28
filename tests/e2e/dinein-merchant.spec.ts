import { expect, test } from "@playwright/test";
import { freshClientIp, loginViaUi } from "./helpers";

test("a table order goes from the guest to the venue and back, and the venue can switch a dish off", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one full run is enough; layouts are covered by the other specs");
  test.setTimeout(120_000);

  // --- Guest orders at a table
  await loginViaUi(page, undefined, "/venues/demo-kitchen");
  await expect(page.getByRole("heading", { name: "Starters" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mains" })).toBeVisible();
  const add = (name: string) => page.getByRole("button", { name: `Add one ${name}` });
  await add("Butter chicken").click();
  await add("Butter chicken").click();
  await add("Butter naan").click();
  await expect(page.getByRole("button", { name: "Add one Red wine glass" })).toHaveCount(0); // alcohol cannot be ordered online
  const table = `T-${10 + Math.floor(Math.random() * 89)}`;
  await page.getByLabel(/Table/).fill(table);
  await page.getByRole("button", { name: "Start table session" }).click();
  await expect(page.getByText("Adding to your open table session")).toBeVisible();
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByText("Order placed")).toBeVisible();
  await page.getByRole("link", { name: "Track this order" }).click();
  await expect(page).toHaveURL(/\/orders\/ORD-/);
  await expect(page.getByText("Waiting for the venue to accept it.")).toBeVisible();
  await expect(page.getByText(`Table ${table}`)).toBeVisible();
  await expect(page.getByText("2 x Butter chicken")).toBeVisible();

  // --- The venue sees it, accepts it, then serves it
  const venueCtx = await browser.newContext();
  const venue = await venueCtx.newPage();
  await freshClientIp(venue);
  await venue.goto("/login?next=/merchant");
  await venue.getByLabel("Mobile number", { exact: true }).fill("9000000004");
  await venue.getByRole("button", { name: "Send code" }).click();
  if (await venue.getByText(/Please wait/).isVisible({ timeout: 2500 }).catch(() => false)) { // a previous run logged this number in moments ago
    await venue.waitForTimeout(31_000);
    await venue.getByRole("button", { name: "Send code" }).click();
  }
  await venue.getByLabel("Verification code", { exact: true }).fill("123456");
  await venue.getByRole("button", { name: "Log in" }).click();
  await expect(venue.getByRole("heading", { name: "Merchant workspace" })).toBeVisible();
  const card = venue.getByRole("listitem").filter({ hasText: `Table ${table}` });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText("2 x")).toBeVisible();
  await expect(card.getByText("Butter chicken")).toBeVisible();
  await card.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("The venue accepted your order and is preparing it.")).toBeVisible({ timeout: 20_000 });
  await venue.getByRole("listitem").filter({ hasText: `Table ${table}` }).getByRole("button", { name: "Mark served" }).click();
  await expect(page.getByText("Enjoy. Pay the bill at the venue.")).toBeVisible({ timeout: 20_000 });

  // --- The venue switches a dish off and the guest sees it
  await venue.getByRole("tab", { name: "Menu" }).click();
  await venue.getByLabel("Venue", { exact: true }).selectOption({ label: "Demo Kitchen [Demo]" });
  const toggle = venue.getByRole("switch", { name: "Sweet lassi available" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await page.goto("/venues/demo-kitchen");
  await expect(page.getByRole("button", { name: "Add one Sweet lassi" })).toHaveCount(0);
  await toggle.click(); // leave the menu as we found it
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await venueCtx.close();
});
