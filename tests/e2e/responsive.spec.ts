import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll } from "./helpers";

test("navigation adapts to the viewport and stays usable", async ({ page }) => {
  await page.goto("/");
  // Phones (< 768px) get the bottom tab bar; tablets and desktops get the top navigation.
  const phone = (page.viewportSize()?.width ?? 1280) < 768;
  const nav = phone ? page.getByRole("navigation", { name: "Main mobile" }) : page.getByRole("navigation", { name: "Main", exact: true });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Events" }).click();
  await expect(page).toHaveURL(/\/events/);
  await expectNoHorizontalScroll(page);
  await expect(nav.getByRole("link", { name: "Events" })).toHaveAttribute("aria-current", "page");
});

test("the phone tab bar stays pinned to the bottom of the screen", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1280) >= 768, "tab bar is phone-only");
  await page.goto("/events");
  const bar = page.getByRole("navigation", { name: "Main mobile" });
  const box = await bar.boundingBox();
  const vh = page.viewportSize()!.height;
  expect(box).not.toBeNull();
  expect(Math.round(box!.y + box!.height)).toBeGreaterThanOrEqual(vh - 1);
});

test("keyboard users can skip to content and see focus", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});
