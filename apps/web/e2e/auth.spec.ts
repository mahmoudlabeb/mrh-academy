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

    await expect(page).toHaveURL(/\/en\/sign-in/);
    await expect(page.getByRole("alert")).toBeVisible();
  });
});
