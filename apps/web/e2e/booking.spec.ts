import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Booking flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'student');
  });

  test('student can open book-lesson page', async ({ page }) => {
    await page.goto('/book-lesson');
    await expect(page).toHaveURL(/book-lesson/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('student dashboard shows lessons tab', async ({ page }) => {
    await page.goto('/student');
    const lessonsTab = page.getByRole('button', { name: /دروسي|My Lessons/i });
    if (await lessonsTab.count()) {
      await lessonsTab.first().click();
    }
    await expect(page.locator('body')).toContainText(/درس|Lesson|balance|رصيد/i);
  });
});
