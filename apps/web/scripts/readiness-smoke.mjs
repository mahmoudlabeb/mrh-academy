import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000';
const readinessLabel = process.env.READINESS_LABEL || 'readiness';
const outputDir = resolve(process.cwd(), '../../dogfood-output', readinessLabel);

function envValue(source, name) {
  const line = source
    .split(/\r?\n/)
    .find((value) => value.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, '');
}

const apiEnv = await readFile(resolve(process.cwd(), '../api/.env'), 'utf8');
const demoPassword = envValue(apiEnv, 'DEMO_SEED_PASSWORD');
if (!demoPassword) throw new Error('DEMO_SEED_PASSWORD is required for admin smoke testing');

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  extraHTTPHeaders: { 'ngrok-skip-browser-warning': 'true' },
});
const page = await context.newPage();
const consoleErrors = [];
const failedResponses = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.message));
page.on('response', (response) => {
  if (response.status() >= 400) {
    failedResponses.push({ status: response.status(), url: response.url() });
  }
});

const pages = [];
for (const path of ['/', '/courses', '/faq', '/help', '/privacy', '/terms', '/login', '/register']) {
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
  pages.push({ path, status: response?.status(), title: await page.title() });
}

await page.goto(baseUrl, { waitUntil: 'networkidle' });
const palette = await page.evaluate(() => {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    [
      '--gold-light',
      '--gold-gradient-start',
      '--gold-gradient-end',
      '--gold-luxury',
      '--green-dark',
      '--teal-light',
      '--gold-bronze',
      '--ivory-pure',
      '--ivory-warm',
      '--ivory-rich',
    ].map((name) => [name, style.getPropertyValue(name).trim().toUpperCase()]),
  );
});
await page.screenshot({ path: resolve(outputDir, 'home-desktop.png'), fullPage: true });

const themeButton = page.getByRole('button', { name: /Switch to (dark|light) mode/ }).first();
const themeBefore = await page.locator('html').getAttribute('data-theme');
await themeButton.click();
const themeAfter = await page.locator('html').getAttribute('data-theme');

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(baseUrl, { waitUntil: 'networkidle' });
const menuButton = page.locator('button[aria-controls="mobile-navigation"]').first();
await menuButton.click();
const mobileMenuVisible = await page.locator('#mobile-navigation').isVisible();
await page.screenshot({ path: resolve(outputDir, 'home-mobile-menu.png'), fullPage: true });
await page.keyboard.press('Escape');
const mobileMenuClosed = await page.locator('#mobile-navigation').isHidden();

await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${baseUrl}/login?redirect=%2Fadmin`, { waitUntil: 'networkidle' });
await page.locator('input[type="email"]').fill('admin.one@mrh-academy.example');
await page.locator('input[type="password"]').fill(demoPassword);
await page.locator('button[type="submit"]').click();
await page.waitForURL(/\/admin(?:\?|$)/, { timeout: 30000 });
await page.waitForLoadState('networkidle');
await page.locator('header').first().waitFor({ state: 'visible', timeout: 30000 });
const adminLayout = await page.evaluate(() => {
  const header = document.querySelector('header');
  const rect = header?.getBoundingClientRect();
  return {
    url: location.pathname + location.search,
    asideCount: document.querySelectorAll('aside').length,
    headerWidth: rect ? Math.round(rect.width) : null,
    viewportWidth: window.innerWidth,
    navCurrentCount: document.querySelectorAll('[aria-current="page"]').length,
  };
});
await page.screenshot({ path: resolve(outputDir, 'admin-top-navigation.png'), fullPage: true });

const result = {
  pages,
  palette,
  theme: { before: themeBefore, after: themeAfter, toggled: themeBefore !== themeAfter },
  mobile: { menuVisible: mobileMenuVisible, menuClosedWithEscape: mobileMenuClosed },
  adminLayout,
  failedResponses: [...new Map(failedResponses.map((item) => [`${item.status}:${item.url}`, item])).values()],
  consoleErrors: [...new Set(consoleErrors)],
};
console.log(JSON.stringify(result, null, 2));
await browser.close();

if (
  pages.some((item) => item.status !== 200) ||
  !result.theme.toggled ||
  !mobileMenuVisible ||
  !mobileMenuClosed ||
  adminLayout.asideCount !== 0 ||
  !adminLayout.headerWidth ||
  adminLayout.headerWidth < adminLayout.viewportWidth * 0.9 ||
  result.consoleErrors.some(
    (message) =>
      !message.includes('ERR_NETWORK_ACCESS_DENIED') &&
      !message.includes('status of 401') &&
      !message.includes('status of 400'),
  )
) {
  process.exitCode = 1;
}
