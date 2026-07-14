import { Page, expect } from '@playwright/test';

export async function loginAs(
  page: Page,
  role: 'admin' | 'student' | 'tutor',
) {
  const emailKey = `TEST_${role.toUpperCase()}_EMAIL`;
  const passwordKey = `TEST_${role.toUpperCase()}_PASSWORD`;
  const email = process.env[emailKey];
  const password = process.env[passwordKey];

  if (!email) {
    throw new Error(`Missing env var: ${emailKey}`);
  }
  if (!password) {
    throw new Error(`Missing env var: ${passwordKey}`);
  }

  await page.context().clearCookies();
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  const rolePath = role === 'admin' ? 'admin' : role;
  await expect(page).toHaveURL(new RegExp(`/${rolePath}`), { timeout: 15000 });
}
