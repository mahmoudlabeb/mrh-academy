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
  await page.waitForLoadState('networkidle');

  const rolePath = role === 'admin' ? 'admin' : role;

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    try {
      await expect(page).toHaveURL(new RegExp(`/${rolePath}`), { timeout: 15000 });
      return;
    } catch {
      // Check if form submitted natively (URL has query params)
      const url = page.url();
      if (url.includes('login?') || url === page.url()) {
        // Wait for React to hydrate and retry
        await page.waitForTimeout(1000);
        continue;
      }
      throw new Error(`Login failed for ${role}. URL: ${url}`);
    }
  }
  throw new Error(`Login failed for ${role} after 3 attempts. URL: ${page.url()}`);
}
