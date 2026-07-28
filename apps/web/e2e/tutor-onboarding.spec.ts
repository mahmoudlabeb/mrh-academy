import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Tutor Onboarding", () => {
  test("should route visitors to sign in", async ({ page }) => {
    await page.goto("/en/become-a-tutor");
    await expect(page).toHaveURL(/\/en\/sign-in/);
  });

  test("should show the application wizard to a learner", async ({ page }) => {
    await loginAs(page, "student");
    await page.goto("/en/become-a-tutor");
    await expect(
      page.getByRole("heading", { name: "Become a tutor" }),
    ).toBeVisible();
    await expect(page.getByText("Step 1 of 8")).toBeVisible();
  });
});
