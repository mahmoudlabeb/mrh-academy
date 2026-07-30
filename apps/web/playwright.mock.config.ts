import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:3210";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "workspace-navigation.mock.spec.ts",
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
    command: "pnpm exec next dev --turbopack --hostname 127.0.0.1 --port 3210",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      API_UPSTREAM_URL: "http://127.0.0.1:9",
    },
  },
});
