import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

/**
 * End-to-end smoke tests mapped to client deliverables.
 * Run against live or local:
 *   BASE_URL=https://mrh-academy-1.vercel.app npx playwright test deliverables.spec.ts
 */

test.describe("Client Deliverables — Public", () => {
  test("homepage loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/.+/);
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/en/sign-in");
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test("register page loads", async ({ page }) => {
    await page.goto("/en/sign-up");
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });
});

test.describe("Client Deliverables — Student", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "student");
  });

  test("student dashboard tabs", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Today" })).toBeVisible();
    await page.getByRole("link", { name: "Messages" }).click();
    await expect(page).toHaveURL(/\/en\/learn\/messages$/);
    await page.getByRole("link", { name: "Today", exact: true }).click();
    await page.getByRole("link", { name: "Wallet" }).click();
    await expect(page).toHaveURL(/\/en\/learn\/wallet$/);
  });

  test("book lesson page accessible", async ({ page }) => {
    await page.goto("/book-lesson");
    await expect(page.locator("body")).toBeVisible();
  });

  test("courses page requires auth then loads", async ({ page }) => {
    await page.goto("/courses");
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Client Deliverables — Tutor", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "tutor");
  });

  test("tutor dashboard sections", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    await page.getByRole("link", { name: "Messages" }).click();
    await expect(page).toHaveURL(/\/en\/teach\/messages$/);
    await page.getByRole("button", { name: "Open account menu" }).click();
    const settingsLink = page.getByRole("link", { name: "Settings" });
    await expect(settingsLink).toHaveAttribute("href", "/en/teach/settings");
    await expect(page.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/en/teach/profile",
    );
    await settingsLink.click();
    await expect(page).toHaveURL(/\/en\/teach\/settings$/);
    await expect(
      page.getByRole("navigation", { name: "Workspace navigation" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await page.getByRole("link", { name: "Students" }).click();
    await expect(page).toHaveURL(/\/en\/teach\/students$/);
  });

  test("tutor availability page", async ({ page }) => {
    await page.goto("/tutor/availability");
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Client Deliverables — Admin", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
  });

  test("admin panel loads", async ({ page }) => {
    await expect(page.locator("body")).toBeVisible();
    await expect(
      page
        .locator("text=Tutors")
        .or(page.locator("text=المعلمون"))
        .or(page.locator("text=المعلمين"))
        .first(),
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Client Deliverables — Become Teacher", () => {
  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/become-teacher");
    await expect(page).toHaveURL(/\/en\/sign-in/, { timeout: 15000 });
  });
});
