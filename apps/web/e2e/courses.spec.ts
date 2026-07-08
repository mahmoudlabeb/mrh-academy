import { test, expect } from '@playwright/test';

test.describe('Courses Flow', () => {
  test('should display course listing page', async ({ page }) => {
    await page.goto('/courses');

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to course detail when clicking a course', async ({ page }) => {
    await page.goto('/courses');

    const courseLinks = page.locator('a[href^="/courses/"]');
    const count = await courseLinks.count();

    if (count > 0) {
      await courseLinks.first().click();
      await expect(page).toHaveURL(/\/courses\//);
      await expect(page.locator('text=Enroll Now').or(page.locator('text=سجل الآن'))).toBeVisible({ timeout: 5000 });
    }
  });

  test('should redirect unauthenticated users to login for enrollment', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/courses');

    const courseLinks = page.locator('a[href^="/courses/"]');
    const count = await courseLinks.count();

    if (count > 0) {
      await courseLinks.first().click();
      const enrollBtn = page.locator('text=Login to Enroll').or(page.locator('text=سجل الدخول للتسجيل'));
      if (await enrollBtn.isVisible()) {
        await enrollBtn.click();
        await expect(page).toHaveURL(/\/login/);
      }
    }
  });
});
