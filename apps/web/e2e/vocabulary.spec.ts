import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("AI Vocabulary Tool", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "student");
  });

  test("should display vocabulary page", async ({ page }) => {
    await page.goto("/en/learn/words");

    await expect(
      page
        .locator("text=AI Vocabulary Assistant")
        .or(page.locator("text=قاموس المفردات الذكي")),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should have search input", async ({ page }) => {
    await page.goto("/en/learn/words");

    const searchInput = page.locator(
      'input[placeholder*="Enter a word"], input[placeholder*="اكتب كلمة"]',
    );
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });
});
