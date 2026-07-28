import { expect, test, type Page, type Response } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import type { E2ERole } from "./helpers/fixtures";

const publicRoutes = [
  "/",
  "/en",
  "/ar",
  "/en/tutors",
  "/ar/tutors",
  "/en/courses",
  "/ar/courses",
  "/en/become-a-tutor",
  "/ar/become-a-tutor",
  "/en/resources",
  "/ar/resources",
  "/en/help",
  "/ar/help",
  "/en/sign-in",
  "/ar/sign-in",
  "/en/sign-up",
  "/ar/sign-up",
  "/en/forgot-password",
  "/ar/forgot-password",
  "/courses",
  "/vocabulary",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password?token=invalid",
  "/verify-email?token=invalid",
  "/faq",
  "/help",
  "/privacy",
  "/terms",
  "/corporate-training",
  "/teacher-training",
  "/tutors/does-not-exist",
  "/courses/does-not-exist",
  "/invite/accept?token=invalid",
  "/auth/callback",
] as const;

const protectedEntryRoutes = [
  "/en/learn",
  "/ar/learn",
  "/en/teach",
  "/ar/teach",
  "/en/ops",
  "/ar/ops",
  "/en/messages",
  "/ar/messages",
  "/en/notifications",
  "/ar/notifications",
  "/en/account/profile",
  "/ar/account/profile",
  "/learn",
  "/teach",
  "/messages",
  "/notifications",
  "/account",
  "/account/profile",
  "/ops",
  "/book-lesson",
  "/become-teacher",
] as const;

const roleRoutes: Record<E2ERole, readonly string[]> = {
  student: [
    "/en/learn",
    "/ar/learn",
    "/en/learn/lessons",
    "/ar/learn/lessons",
    "/en/learn/courses",
    "/ar/learn/courses",
    "/en/learn/wallet",
    "/ar/learn/wallet",
    "/en/learn/wallet/add",
    "/ar/learn/wallet/add",
    "/en/learn/saved",
    "/ar/learn/saved",
    "/en/learn/words",
    "/ar/learn/words",
    "/student",
    "/student/discover",
    "/student/lessons",
    "/student/wallet",
    "/student/profile",
    "/learn",
    "/messages",
    "/notifications",
    "/account",
    "/account/profile",
    "/book-lesson",
  ],
  tutor: [
    "/en/teach",
    "/ar/teach",
    "/en/teach/classroom",
    "/en/teach/schedule",
    "/en/teach/availability",
    "/en/teach/students",
    "/en/teach/courses",
    "/en/teach/courses/new/studio",
    "/en/teach/earnings",
    "/en/teach/earnings/payout",
    "/en/teach/insights",
    "/en/teach/profile",
    "/tutor",
    "/tutor/availability",
    "/tutor/lessons",
    "/tutor/earnings",
    "/tutor/profile",
    "/teach",
    "/messages",
    "/notifications",
    "/account",
    "/account/profile",
  ],
  admin: [
    "/en/ops",
    "/ar/ops",
    "/en/ops/people",
    "/en/ops/lessons",
    "/en/ops/money/payments",
    "/en/ops/settings",
    "/admin",
    "/admin/articles",
    "/admin/payouts",
    "/admin/teachers",
    "/ops",
    "/notifications",
    "/account",
    "/account/profile",
  ],
};

async function expectHealthyPage(page: Page, route: string) {
  const pageErrors: string[] = [];
  const onPageError = (error: Error) => pageErrors.push(error.message);
  page.on("pageerror", onPageError);

  try {
    let response: Response | null | undefined;
    try {
      response = await page.goto(route, { waitUntil: "domcontentloaded" });
    } catch (error) {
      // Next.js redirect-only routes can replace the document while Playwright
      // is still observing the original navigation.
      if (!(error instanceof Error) || !error.message.includes("ERR_ABORTED")) {
        throw error;
      }
      await page.waitForLoadState("domcontentloaded");
    }
    if (response) {
      expect(
        response.status(),
        `${route} returned a server error`,
      ).toBeLessThan(500);
    }
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      /Internal Server Error|Application error: a client-side exception/i,
    );
    expect(pageErrors, `${route} emitted an uncaught browser error`).toEqual(
      [],
    );
  } finally {
    page.off("pageerror", onPageError);
  }
}

test.describe("Production route coverage", () => {
  test("renders every public and protected entry route without crashing", async ({
    page,
  }) => {
    for (const route of [...publicRoutes, ...protectedEntryRoutes]) {
      await expectHealthyPage(page, route);
    }
  });

  test("does not request camera or microphone before room authorization", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "__mediaRequestCount", {
        configurable: true,
        value: 0,
        writable: true,
      });
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => {
            (
              window as typeof window & { __mediaRequestCount: number }
            ).__mediaRequestCount += 1;
            throw new DOMException("Blocked by E2E", "NotAllowedError");
          },
        },
      });
    });

    for (const route of [
      "/en/room/e2e-security-smoke",
      "/ar/room/e2e-security-smoke",
      "/room/e2e-security-smoke",
      "/classroom/e2e-security-smoke",
    ]) {
      await expectHealthyPage(page, route);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as typeof window & { __mediaRequestCount: number })
                .__mediaRequestCount,
          ),
        )
        .toBe(0);
    }
  });

  for (const role of ["student", "tutor", "admin"] as const) {
    test(`renders every ${role} workspace route`, async ({ page }) => {
      await loginAs(page, role);
      for (const route of roleRoutes[role]) {
        await expectHealthyPage(page, route);
      }
    });
  }
});
