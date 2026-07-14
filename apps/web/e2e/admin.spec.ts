import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
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
