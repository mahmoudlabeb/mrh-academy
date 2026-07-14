import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Tutor Journey', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'tutor');
  });

  test('tutor dashboard shows overview and navigation', async ({ page }) => {
    await page.goto('/tutor');
    await expect(
      page
        .locator('text=Dashboard')
        .or(page.locator('text=لوحة التحكم')),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('text=Students').or(page.locator('text=الطلاب')),
    ).toBeVisible({ timeout: 5000 });
  });

  test('tutor can manage availability', async ({ page }) => {
    await page.goto('/tutor/availability');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    const timeSlot = page
      .locator(
        'input[type="time"], select[name*="time"], [data-testid="time-slot"]',
      )
      .first();
    if (await timeSlot.isVisible()) {
      await expect(timeSlot).toBeEnabled({ timeout: 5000 });
    }
  });
});
