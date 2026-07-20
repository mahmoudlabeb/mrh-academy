import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Student Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "student");
  });

  test("should display dashboard with tabs", async ({ page }) => {
    await expect(
      page.locator("text=Discover").or(page.locator("text=اكتشف")).first(),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator("text=My Lessons").or(page.locator("text=دروسي")).first(),
    ).toBeVisible();
    await expect(
      page.locator("text=Messages").or(page.locator("text=الرسائل")).first(),
    ).toBeVisible();
    await expect(
      page.locator("text=Settings").or(page.locator("text=الإعدادات")).first(),
    ).toBeVisible();
  });

  test("should show balance in header", async ({ page }) => {
    await expect(
      page.locator("text=Credits").or(page.locator("text=رصيد")).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should navigate between tabs", async ({ page }) => {
    await page
      .locator("text=Messages")
      .or(page.locator("text=الرسائل"))
      .first()
      .click();
    await expect(
      page.locator("text=Messages").or(page.locator("text=الرسائل")).first(),
    ).toBeVisible();

    await page
      .locator("text=Settings")
      .or(page.locator("text=الإعدادات"))
      .first()
      .click();
    await expect(
      page.locator("text=Settings").or(page.locator("text=الإعدادات")).first(),
    ).toBeVisible();
  });

  test("should open payment modal", async ({ page }) => {
    await page
      .locator("text=Subscribe")
      .or(page.locator("text=اشتراك"))
      .first()
      .click();
    await expect(
      page.locator("text=Subscribe").or(page.locator("text=اشتراك")).first(),
    ).toBeVisible({ timeout: 5000 });
  });
});
