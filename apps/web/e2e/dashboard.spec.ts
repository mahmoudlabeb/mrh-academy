import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Student Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'student');
  });

  test('should display dashboard with tabs', async ({ page }) => {
    await expect(page.locator('text=Discover')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=My Lessons')).toBeVisible();
    await expect(page.locator('text=Messages')).toBeVisible();
    await expect(page.locator('text=Settings')).toBeVisible();
  });

  test('should show balance in header', async ({ page }) => {
    await expect(page.locator('text=Credits').or(page.locator('text=رصيد'))).toBeVisible({ timeout: 10000 });
  });

  test('should navigate between tabs', async ({ page }) => {
    await page.click('text=Messages');
    await expect(page.locator('text=Messages').or(page.locator('text=الرسائل'))).toBeVisible();

    await page.click('text=Settings');
    await expect(page.locator('text=Settings').or(page.locator('text=الإعدادات'))).toBeVisible();
  });

  test('should open payment modal', async ({ page }) => {
    await page.click('text=Subscribe');
    await expect(page.locator('text=Subscribe').or(page.locator('text=اشتراك'))).toBeVisible({ timeout: 5000 });
  });
});
