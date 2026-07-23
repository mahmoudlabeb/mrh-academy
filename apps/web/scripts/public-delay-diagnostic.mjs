import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000';
const outputDir = resolve(process.cwd(), '../../dogfood-output/public-delay');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  extraHTTPHeaders: { 'ngrok-skip-browser-warning': 'true' },
});
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const failedResponses = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) =>
  failedRequests.push({ url: request.url(), error: request.failure()?.errorText }),
);
page.on('response', (response) => {
  if (response.status() >= 400) {
    failedResponses.push({ status: response.status(), url: response.url() });
  }
});

const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(30000);
const bodyText = await page.locator('body').innerText();
const headingCount = await page.locator('h1').count();
const relevantFailedResponses = failedResponses.filter(
  ({ status, url }) =>
    status >= 500 ||
    (status >= 400 &&
      !url.includes('/api/v1/users/me') &&
      !url.includes('/api/v1/auth/refresh')),
);
const relevantFailedRequests = failedRequests.filter(
  ({ url, error }) =>
    error !== 'net::ERR_ABORTED' &&
    !url.includes('/_rsc=') &&
    !url.includes('images.unsplash.com'),
);
const result = {
  baseUrl,
  initialStatus: response?.status(),
  finalUrl: page.url(),
  hasErrorBoundary: /Something went wrong|حدث خطأ|Please try again/i.test(bodyText),
  hasHomeHeading: headingCount > 0,
  headingCount,
  consoleErrors,
  pageErrors,
  failedRequests,
  failedResponses,
  relevantFailedRequests,
  relevantFailedResponses,
};
await page.screenshot({ path: resolve(outputDir, 'homepage-after-30s.png'), fullPage: true });
console.log(JSON.stringify(result, null, 2));
await browser.close();
if (
  result.hasErrorBoundary ||
  result.pageErrors.length ||
  result.relevantFailedRequests.length ||
  result.relevantFailedResponses.length
) {
  process.exitCode = 1;
}
