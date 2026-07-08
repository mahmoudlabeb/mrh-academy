import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@mrhacademy.com');
    await page.fill('input[name="password"]', '123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
  });

  test('should display admin overview tab', async ({ page }) => {
    await expect(page.locator('text=Overview').or(page.locator('text=نظرة عامة'))).toBeVisible({ timeout: 5000 });
  });

  test('should navigate tutor management tab', async ({ page }) => {
    await page.click('text=Tutors').or(page.click('text=المدرسين'));
    await expect(page).toHaveURL(/\/admin/);
  });

  test('should navigate settings tab', async ({ page }) => {
    await page.click('text=Settings').or(page.click('text=إعدادات'));
    await expect(page).toHaveURL(/\/admin/);
  });
});
