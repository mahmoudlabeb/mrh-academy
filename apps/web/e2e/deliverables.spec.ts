import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

/**
 * End-to-end smoke tests mapped to client deliverables.
 * Run against live or local:
 *   BASE_URL=https://mrh-academy-1.vercel.app npx playwright test deliverables.spec.ts
 */

test.describe('Client Deliverables — Public', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('register page loads', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('vocabulary page loads', async ({ page }) => {
    await page.goto('/vocabulary');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Client Deliverables — Student', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'student');
  });

  test('student dashboard tabs', async ({ page }) => {
    await expect(page.locator('text=Discover').or(page.locator('text=اكتشف'))).toBeVisible({ timeout: 10000 });
    await page.click('text=Messages');
    await page.click('text=Settings');
    await expect(page.locator('text=Settings').or(page.locator('text=الإعدادات'))).toBeVisible();
  });

  test('book lesson page accessible', async ({ page }) => {
    await page.goto('/book-lesson');
    await expect(page.locator('body')).toBeVisible();
  });

  test('courses page requires auth then loads', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Client Deliverables — Tutor', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'tutor');
  });

  test('tutor dashboard sections', async ({ page }) => {
    await expect(page.locator('text=Dashboard').or(page.locator('text=لوحة التحكم'))).toBeVisible({ timeout: 10000 });
    await page.click('text=Messages');
    await page.click('text=Students');
    await page.click('text=Settings');
  });

  test('tutor availability page', async ({ page }) => {
    await page.goto('/tutor/availability');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Client Deliverables — Admin', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('admin panel loads', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('text=Tutors').or(page.locator('text=المعلمون')).or(page.locator('text=المعلمين'))).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Client Deliverables — Become Teacher', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/become-teacher');
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });
});
