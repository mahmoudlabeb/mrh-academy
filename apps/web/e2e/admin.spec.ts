import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Admin Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
  });

  test("should display admin overview tab", async ({ page }) => {
    await expect(
      page.locator(`:has-text("Overview"), :has-text("نظرة عامة")`).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should navigate tutor management tab", async ({ page }) => {
    await page
      .locator(`:has-text("Tutors"), :has-text("المدرسين")`)
      .first()
      .click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test("should navigate settings tab", async ({ page }) => {
    await page
      .locator(`:has-text("Settings"), :has-text("إعدادات")`)
      .first()
      .click();
    await expect(page).toHaveURL(/\/admin/);
  });
});
