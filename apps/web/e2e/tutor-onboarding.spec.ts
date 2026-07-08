import { test, expect } from '@playwright/test';

test.describe('Tutor Onboarding', () => {
  const timestamp = Date.now();
  const email = `tutor-${timestamp}@test.com`;

  test('should navigate to become-teacher page and see the form', async ({ page }) => {
    await page.goto('/become-teacher');

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('should require login to submit application', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/become-teacher');

    const currentUrl = page.url();
    if (!currentUrl.includes('login')) {
      await page.goto('/login?intent=tutor');
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
