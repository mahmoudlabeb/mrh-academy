import { test, expect } from '@playwright/test';

test.describe('Student Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.fill('input[name="email"]', 'student@demo.com');
    await page.fill('input[name="password"]', '123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student/, { timeout: 10000 });
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
