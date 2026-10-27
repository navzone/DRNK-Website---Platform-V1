import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll } from "./helpers";

test("Explore loads without authentication and search filters results", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByRole("heading", { name: "Venues in Bengaluru" })).toBeVisible();
  await expect(page.getByText(/\d+ venues?/)).toBeVisible();
  await page.getByLabel("Search").fill("taproom");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/q=taproom/);
  await expect(page.getByText("Demo Taproom")).toBeVisible();
  await page.getByLabel("Search").fill("zzzzzz");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("No venues match")).toBeVisible();
});

test("venue, event and talent pages are public and do not overflow", async ({ page }) => {
  for (const path of ["/", "/explore", "/venues/demo-taproom", "/events", "/events/demo-friday-night", "/talents", "/talents/dj-demo"]) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
});

test("every policy page is reachable from the footer", async ({ page }) => {
  await page.goto("/");
  const links = await page.getByRole("navigation", { name: "Legal" }).getByRole("link").all();
  expect(links.length).toBe(12);
  for (const slug of ["terms", "privacy", "refunds", "grievance"]) {
    await page.goto(`/legal/${slug}`);
    await expect(page.getByRole("note")).toContainText("Draft for review");
  }
});

test("protected pages send anonymous users to login", async ({ page }) => {
  for (const path of ["/account", "/admin", "/merchant"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});

test("invalid filters show a recoverable message", async ({ page }) => {
  await page.goto("/explore?category=bogus");
  await expect(page.getByText("Those filters aren't valid")).toBeVisible();
  await page.getByRole("link", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Venues in Bengaluru" })).toBeVisible();
});
