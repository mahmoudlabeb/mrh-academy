import { test, expect } from '@playwright/test';

test.describe('AI Vocabulary Tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.fill('input[name="email"]', 'student@demo.com');
    await page.fill('input[name="password"]', '123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student/, { timeout: 10000 });
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
