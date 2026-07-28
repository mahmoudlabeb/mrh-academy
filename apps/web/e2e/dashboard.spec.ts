import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Student Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "student");
  });

  test("should display the learner workspace navigation", async ({ page }) => {
    for (const name of [
      "Today",
      "Lessons",
      "Courses",
      "Messages",
      "Wallet",
      "Saved",
      "Vocabulary",
    ]) {
      await expect(
        page.getByRole("link", { name, exact: true }),
      ).toBeVisible();
    }
  });

  test("should show balance in header", async ({ page }) => {
    await page.getByRole("link", { name: "Wallet", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "MRH Wallet & Payments" }),
    ).toBeVisible();
  });

  test("should navigate between tabs", async ({ page }) => {
    await page.getByRole("link", { name: "Messages" }).click();
    await expect(page).toHaveURL(/\/en\/messages$/);
    await page.goto("/en/learn");
    await page.getByRole("link", { name: "Saved" }).click();
    await expect(page).toHaveURL(/\/en\/learn\/saved$/);
  });

  test("should open the server-authoritative add-funds panel", async ({
    page,
  }) => {
    await page.goto("/en/learn/wallet");
    await page.getByRole("link", { name: /Add funds/i }).click();
    await expect(page).toHaveURL(/\/en\/learn\/wallet\/add$/);
    await expect(
      page.getByRole("heading", { name: "Add funds to MRH Wallet" }),
    ).toBeVisible();
  });
});
