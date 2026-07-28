import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Admin Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
  });

  test("should display the operations queue", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Operations Decision Queue" }),
    ).toBeVisible();
  });

  test("should navigate to the people directory", async ({ page }) => {
    await page.getByRole("link", { name: "People" }).click();
    await expect(page).toHaveURL(/\/en\/ops\/people$/);
  });

  test("should navigate settings", async ({ page }) => {
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/ops\/settings$/);
  });
});
