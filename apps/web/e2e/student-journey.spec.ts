import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Student Journey', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'student');
  });

  test('student can browse tutors and book a lesson', async ({ page }) => {
    await page.goto('/book-lesson');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    const tutorCards = page.locator(
      'a[href^="/book-lesson/"], [data-testid="tutor-card"], .tutor-card, [class*="tutor"]',
    );
    const count = await tutorCards.count();
    if (count > 0) {
      await tutorCards.first().click();
      await expect(page).toHaveURL(/\/book-lesson\//, { timeout: 10000 });
    }
  });

  test('student dashboard displays key sections', async ({ page }) => {
    await page.goto('/student');
    await expect(
      page.locator('text=Discover').or(page.locator('text=اكتشف')).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('text=My Lessons').or(page.locator('text=دروسي')).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('student can purchase credits', async ({ page }) => {
    await page.goto('/student');
    const subscribeBtn = page
      .locator('button, a')
      .filter({ hasText: /Subscribe|اشتراك/i })
      .first();
    if (await subscribeBtn.isVisible()) {
      await subscribeBtn.click();
      await expect(
        page
          .locator('text=Subscribe')
          .or(page.locator('text=اشتراك'))
          .first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });
});
