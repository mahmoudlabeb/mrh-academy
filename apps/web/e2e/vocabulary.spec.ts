import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('AI Vocabulary Tool', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'student');
  });

  test('should display vocabulary page', async ({ page }) => {
    await page.goto('/vocabulary');

    await expect(page.locator('text=AI Vocabulary').or(page.locator('text=المفردات الذكي'))).toBeVisible({ timeout: 10000 });
  });

  test('should have search input', async ({ page }) => {
    await page.goto('/vocabulary');

    const searchInput = page.locator('input[placeholder*="word"], input[placeholder*="كلمة"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });
});
