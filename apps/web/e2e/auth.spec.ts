import { test, expect } from "@playwright/test";
import { loginAs, loginThroughUi } from "./helpers/auth";
import { readE2EFixtures } from "./helpers/fixtures";

test.describe("Authentication Flow", () => {
  test("should register a new user", async ({ page }) => {
    const fixtures = await readE2EFixtures();
    const testEmail = `playwright-${fixtures.runId}-registration@mrh-academy.example`;
    const password = "Browser-registration-2026!";
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    await page.fill('input[name="firstName"]', "QA");
    await page.fill('input[name="lastName"]', "Bot");
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/verify-email/);
    await expect(page).toHaveURL(
      new RegExp(`email=${encodeURIComponent(testEmail)}`),
    );
  });

  test("should login with a provisioned admin account", async ({ page }) => {
    await loginThroughUi(page, "admin");
  });

  test("should restore a provisioned student session", async ({ page }) => {
    await loginAs(page, "student");
  });

  test("should show validation errors on invalid login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.fill('input[name="email"]', "invalid@mrh-academy.example");
    await page.fill('input[name="password"]', "Wrong-password-2026!");

    await page.locator('button[type="submit"]').click();

    // Should stay on login page (not redirect to dashboard)
    await expect(page).toHaveURL(/\/login/);
  });
});
