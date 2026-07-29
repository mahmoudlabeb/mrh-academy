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
    ]) {
      await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
    }
  });

  test("should show balance in header", async ({ page }) => {
    await page.getByRole("link", { name: "Wallet", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "MRH Wallet & Payments" }),
    ).toBeVisible();
  });

  test("should expose settings and logout from the profile menu", async ({
    page,
  }) => {
    const profileTrigger = page.getByRole("button", {
      name: "Open account menu",
    });
    await profileTrigger.click();
    await expect(profileTrigger).toHaveAttribute("aria-expanded", "true");
    const settingsLink = page.getByRole("link", { name: "Settings" });
    await expect(settingsLink).toHaveAttribute("href", "/en/learn/settings");
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
    await settingsLink.click();
    await expect(page).toHaveURL(/\/en\/learn\/settings$/);
    await expect(
      page.getByRole("navigation", { name: "Workspace navigation" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Security" }).click();
    await expect(page).toHaveURL(/\/en\/learn\/settings\/security$/);
  });

  test("should navigate between tabs", async ({ page }) => {
    await page.getByRole("link", { name: "Messages" }).click();
    await expect(page).toHaveURL(/\/en\/learn\/messages$/);
    await expect(
      page.getByRole("navigation", { name: "Workspace navigation" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Today", exact: true }).click();
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
