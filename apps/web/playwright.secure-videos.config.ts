import { defineConfig, devices } from "@playwright/test";

const port = 3217;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "secure-videos.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm exec next dev --turbopack --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      ...process.env,
      API_UPSTREAM_URL: "http://127.0.0.1:49999",
    },
  },
});
