import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Authentication Flow', () => {
  const timestamp = Date.now();
  const testEmail = `playwright-${timestamp}@test.com`;
  const password = 'Test1234';

  test('should register a new user', async ({ page }) => {
    await page.goto('/register');

    await page.fill('input[name="firstName"]', 'QA');
    await page.fill('input[name="lastName"]', 'Bot');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/student/);
  });

  test('should login with seeded admin account', async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('should login with seeded student account', async ({ page }) => {
    await loginAs(page, 'student');
  });

  test('should show validation errors on invalid login', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'invalid@test.com');
    await page.fill('input[name="password"]', 'wrongpass');

    await page.click('button[type="submit"]');

    await expect(page.locator('text=Invalid')).toBeVisible({ timeout: 10000 });
  });
});
