import { defineConfig, devices } from '@playwright/test';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig({ path: '.env.test' });

const baseURL = process.env.BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],
  timeout: 120000,
  globalSetup: './e2e/global-setup.ts',
  expect: {
    timeout: 30000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    actionTimeout: 15000,
    navigationTimeout: 30000,

  },
  webServer: process.env.SKIP_WEB_SERVER
    ? undefined
    : {
        command: 'pnpm dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180000,
        env: {
          ...process.env,
          API_UPSTREAM_URL:
            process.env.API_UPSTREAM_URL || 'http://localhost:4000',
        },
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
