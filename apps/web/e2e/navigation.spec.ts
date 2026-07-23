import { expect, test } from "@playwright/test";

test.describe("Public navigation", () => {
  test("marks the active route accessibly", async ({ page }) => {
    await page.goto("/courses");

    await expect(
      page.getByRole("link", { name: /الكورسات|Courses/ }).first(),
    ).toHaveAttribute("aria-current", "page");
  });

  test("opens and closes the mobile menu with the keyboard", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const menuButton = page.getByRole("button", {
      name: /فتح القائمة|Open menu/,
    });
    await expect(menuButton).toHaveAttribute(
      "aria-controls",
      "mobile-navigation",
    );

    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#mobile-navigation")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("#mobile-navigation")).toBeHidden();
    await expect(menuButton).toBeFocused();
  });
});
