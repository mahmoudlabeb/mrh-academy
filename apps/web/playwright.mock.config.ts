import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3210";

export default defineConfig({
  testDir: "./e2e",
  testMatch: [
    "workspace-navigation.mock.spec.ts",
    "classroom-flow.mock.spec.ts",
    "paid-learning-flow.mock.spec.ts",
    "payment-smoke.spec.ts",
    "admin-payment-ledger.mock.spec.ts",
    "course-studio.mock.spec.ts",
    "product-approval.mock.spec.ts",
    "tutor-payouts.mock.spec.ts",
    "secure-videos.spec.ts",
  ],
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: "node_modules/.bin/next dev --hostname 127.0.0.1 --port 3210",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      API_UPSTREAM_URL: "http://127.0.0.1:9",
    },
  },
});
