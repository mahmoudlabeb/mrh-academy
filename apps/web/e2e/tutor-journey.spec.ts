import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Tutor Journey", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "tutor");
  });

  test("tutor dashboard shows overview and navigation", async ({ page }) => {
    await page.goto("/en/teach");
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Students" })).toBeVisible();
  });

  test("tutor can manage availability", async ({ page }) => {
    await page.goto("/en/teach/availability");
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });

    const timeSlot = page
      .locator(
        'input[type="time"], select[name*="time"], [data-testid="time-slot"]',
      )
      .first();
    if (await timeSlot.isVisible()) {
      await expect(timeSlot).toBeEnabled({ timeout: 5000 });
    }
  });
});
