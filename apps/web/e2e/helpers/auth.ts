import { Page, expect } from "@playwright/test";
import { E2ERole, readE2EFixtures } from "./fixtures";

export async function loginAs(page: Page, role: E2ERole) {
  const fixture = (await readE2EFixtures()).roles[role];
  await page.context().clearCookies();
  await page.context().addCookies(fixture.cookies);
  await page.goto(fixture.homePath);
  const canonicalWorkspace =
    role === "tutor"
      ? /\/(?:tutor|(?:en|ar)\/teach)(?:$|[/?#])/
      : role === "student"
        ? /\/(?:student|(?:en|ar)\/learn)(?:$|[/?#])/
        : /\/(?:admin|(?:en|ar)\/ops)(?:$|[/?#])/;
  const workspaceNavigation = page.getByRole("navigation", {
    name: "Workspace navigation",
  });
  const sessionRestored =
    canonicalWorkspace.test(page.url()) &&
    (await workspaceNavigation
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => true)
      .catch(() => false));
  if (!sessionRestored) {
    await loginThroughUi(page, role);
    return;
  }
  await expect(page).toHaveURL(canonicalWorkspace);
}

export async function loginThroughUi(page: Page, role: E2ERole) {
  const fixture = (await readE2EFixtures()).roles[role];
  await page.context().clearCookies();
  await page.goto("/en/sign-in");
  await page.waitForLoadState("networkidle");
  await page.fill('input[name="email"]', fixture.email);
  await page.fill('input[name="password"]', fixture.password);
  await page.getByRole("button", { name: /sign in|تسجيل الدخول/i }).click();

  const canonicalWorkspace =
    role === "tutor"
      ? /\/(?:tutor|(?:en|ar)\/teach)(?:$|[/?#])/
      : role === "student"
        ? /\/(?:student|(?:en|ar)\/learn)(?:$|[/?#])/
        : /\/(?:admin|(?:en|ar)\/ops)(?:$|[/?#])/;
  await expect(page).toHaveURL(canonicalWorkspace, { timeout: 15000 });
}
