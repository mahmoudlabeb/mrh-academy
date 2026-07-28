import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Student Journey", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "student");
  });

  test("student can browse tutors and book a lesson", async ({ page }) => {
    await page.goto("/en/tutors");
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });

    const bookingLinks = page.locator('a[href*="/tutors/"][href$="/book"]');
    const count = await bookingLinks.count();
    if (count > 0) {
      await bookingLinks.first().click();
      await expect(page).toHaveURL(/\/tutors\/.+\/book/, { timeout: 10000 });
    }
  });

  test("student dashboard displays key sections", async ({ page }) => {
    await page.goto("/en/learn");
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Lessons" })).toBeVisible();
  });

  test("student can purchase credits", async ({ page }) => {
    await page.goto("/en/learn/wallet");
    await page.getByRole("link", { name: /Add funds/i }).click();
    await expect(page).toHaveURL(/\/en\/learn\/wallet\/add$/);
    await expect(
      page.getByRole("heading", { name: "Add funds to MRH Wallet" }),
    ).toBeVisible();
  });
});
