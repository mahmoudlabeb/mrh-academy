import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  const timestamp = Date.now();
  const testEmail = `playwright-${timestamp}@test.com`;
  const password = 'Test1234';

  test('should register a new user', async ({ page }) => {
    await page.goto('/register');
    
    // Fill the form
    await page.fill('input[name="firstName"]', 'QA');
    await page.fill('input[name="lastName"]', 'Bot');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);
    
    // Role is automatically set to student via a hidden field
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Should redirect to student dashboard
    await expect(page).toHaveURL(/\/student/);
  });

  test('should login an existing user', async ({ page }) => {
    // If running in sequence, the user might already be logged in. 
    // We clear cookies to ensure a fresh login.
    await page.context().clearCookies();
    await page.goto('/login');
    
    // Use the seeded test user from backend if the dynamic one wasn't created properly
    await page.fill('input[name="email"]', 'student1@mrhacademy.com');
    await page.fill('input[name="password"]', 'Password123!');
    
    await page.click('button[type="submit"]');
    
    // Expect successful redirection to student dashboard (student1 is a student)
    await expect(page).toHaveURL(/\/student/);
  });

  test('should show validation errors on invalid login', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="password"]', '');
    
    await page.click('button[type="submit"]');
    
    // The browser's native HTML5 validation (type="email") will block submission,
    // so we just verify we are still on the login page.
    await expect(page).toHaveURL(/\/login/);
  });
});
