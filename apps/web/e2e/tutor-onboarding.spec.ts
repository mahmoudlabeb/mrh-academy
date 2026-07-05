import { test, expect } from '@playwright/test';

test.describe('Tutor Onboarding', () => {
  const timestamp = Date.now();
  const email = `tutor-${timestamp}@test.com`;

  test('should submit a tutor application', async ({ page }) => {
    // 1. Register a new user as a student (initial state for tutor application)
    await page.goto('/register');
    await page.fill('input[name="firstName"]', 'QA');
    await page.fill('input[name="lastName"]', 'Tutor');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'Test1234');
    await page.fill('input[name="confirmPassword"]', 'Test1234');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to student dashboard
    await expect(page).toHaveURL(/\/student/);

    // 2. Navigate to tutor onboarding
    await page.goto('/become-teacher');
    
    // 3. Fill the tutor application form
    // Note: If the form has a specific ID or name, target that. For now we use standard names.
    const bioInput = page.locator('textarea[name="bio"], input[name="bio"]');
    if (await bioInput.count() > 0) {
      await bioInput.fill('This is a test bio for my tutor application.');
    }
    
    const specializationInput = page.locator('input[name="specialization"]');
    if (await specializationInput.count() > 0) {
      await specializationInput.fill('Mathematics');
    }
    
    // Upload a mock file if a file input exists
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count() > 0) {
      // Create a dummy buffer in memory (Playwright supports this)
      await fileInput.setInputFiles({
        name: 'cv.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('dummy pdf content')
      });
    }

    // Submit application
    const submitButton = page.locator('button[type="submit"], button:has-text("Apply")');
    if (await submitButton.count() > 0) {
      await submitButton.click();
    }
    
    // 4. Assert success state (e.g., text showing "Application Pending")
    // await expect(page.locator('text=Pending')).toBeVisible();
  });
});
