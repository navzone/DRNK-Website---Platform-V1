import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll } from "./helpers";

test("navigation adapts to the viewport and stays usable", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByText("Menu").click();
    await page.getByRole("navigation", { name: "Main mobile" }).getByRole("link", { name: "Events" }).click();
  } else {
    await page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: "Events" }).click();
  }
  await expect(page).toHaveURL(/\/events/);
  await expectNoHorizontalScroll(page);
});

test("keyboard users can skip to content and see focus", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});
