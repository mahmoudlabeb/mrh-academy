import { test, expect } from "@playwright/test";
import { loginAs, loginThroughUi } from "./helpers/auth";
import { readE2EFixtures } from "./helpers/fixtures";

test.describe("Authentication Flow", () => {
  test("should register a new user", async ({ page }) => {
    const fixtures = await readE2EFixtures();
    const testEmail = `playwright-${fixtures.runId}-registration@mrh-academy.example`;
    const password = "Browser-registration-2026!";
    await page.goto("/en/sign-up");
    await page.waitForLoadState("networkidle");

    await page.fill('input[name="firstName"]', "QA");
    await page.fill('input[name="lastName"]', "Bot");
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);

    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Check your email")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Return to sign in" }),
    ).toBeVisible();
  });

  test("should login with a provisioned admin account", async ({ page }) => {
    await loginThroughUi(page, "admin");
  });

  test("shows a password mismatch when sign-up is submitted with Enter", async ({
    page,
  }) => {
    await page.goto("/en/sign-up");
    await page.fill('input[name="firstName"]', "QA");
    await page.fill('input[name="lastName"]', "Bot");
    await page.fill('input[name="email"]', "mismatch@mrh-academy.example");
    await page.fill('input[name="password"]', "Browser-registration-2026!");
    await page.fill(
      'input[name="confirmPassword"]',
      "Different-registration-2026!",
    );
    await page.locator('input[name="confirmPassword"]').press("Enter");

    await expect(page.getByRole("alert")).toContainText(
      "Passwords do not match.",
    );
  });

  test("should restore a provisioned student session", async ({ page }) => {
    await loginAs(page, "student");
  });

  test("should show validation errors on invalid login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/en/sign-in");
    await page.waitForLoadState("networkidle");

    await page.fill('input[name="email"]', "invalid@mrh-academy.example");
    await page.fill('input[name="password"]', "Wrong-password-2026!");

    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/en\/sign-in$/);
    await expect(page.locator(".blueprint-error")).toHaveText(
      "Invalid email or password",
    );
  });

  test("should verify an email from a localized link", async ({ page }) => {
    await page.route("**/auth/verify-email", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "verified" }),
      });
    });

    await page.goto("/en/verify-email?token=e2e-verification-token");

    await expect(page.getByRole("status")).toContainText("Email verified");
  });

  test("should reset a password from a localized link", async ({ page }) => {
    await page.route("**/auth/reset-password", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "changed" }),
      });
    });

    await page.goto("/en/reset-password?token=e2e-reset-token");
    await page.getByLabel("New password").fill("New-browser-password-2026!");
    await page
      .getByLabel("Confirm password")
      .fill("New-browser-password-2026!");
    await page.getByRole("button", { name: "Change password" }).click();

    await expect(page.getByRole("status")).toContainText(
      "Password changed successfully",
    );
  });
});
