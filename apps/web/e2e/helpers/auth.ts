import { Page, expect } from "@playwright/test";
import { E2ERole, readE2EFixtures } from "./fixtures";

export async function loginAs(page: Page, role: E2ERole) {
  const fixture = (await readE2EFixtures()).roles[role];
  await page.context().clearCookies();
  await page.context().addCookies(fixture.cookies);
  await page.goto(fixture.homePath);
  await expect(page).toHaveURL(new RegExp(`${fixture.homePath}(?:$|[/?#])`));
}

export async function loginThroughUi(page: Page, role: E2ERole) {
  const fixture = (await readE2EFixtures()).roles[role];
  await page.context().clearCookies();
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.fill('input[name="email"]', fixture.email);
  await page.fill('input[name="password"]', fixture.password);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(new RegExp(`${fixture.homePath}(?:$|[/?#])`), {
    timeout: 15000,
  });
}
