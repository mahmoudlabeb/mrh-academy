import { test, expect } from "@playwright/test";

test.describe("Courses Flow", () => {
  test("should display course listing page", async ({ page }) => {
    await page.goto("/courses");

    await expect(page.locator("h1").first()).toBeVisible({ timeout: 10000 });
  });

  test("should navigate to course detail when clicking a course", async ({
    page,
  }) => {
    await page.goto("/courses");

    const courseLinks = page.locator('a[href^="/courses/"]');
    const count = await courseLinks.count();

    if (count > 0) {
      await courseLinks.first().click();
      await expect(page).toHaveURL(/\/courses\//);
      await expect(page.getByText(/Enroll Now|سجل الآن/)).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("requires a verified account before course checkout", async ({
    page,
  }) => {
    await page.context().clearCookies();
    let checkoutRequests = 0;
    await page.route("**/api/v1/users/me", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthenticated smoke user" }),
      }),
    );
    await page.route("**/api/v1/auth/csrf", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ csrfToken: "smoke-token" }),
        headers: { "Set-Cookie": "mrh_csrf=smoke-token; Path=/" },
      }),
    );
    await page.route("**/api/v1/auth/refresh", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "No refresh session" }),
      }),
    );
    await page.route("**/api/v1/courses/secure-checkout-e2e", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "secure-checkout-e2e",
          title: "Secure checkout course",
          description: "Regression fixture",
          price: 49,
          tutor: { firstName: "QA", lastName: "Tutor" },
        }),
      }),
    );
    await page.route("**/api/v1/payments/course-checkout", (route) => {
      checkoutRequests += 1;
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Checkout must not be called" }),
      });
    });

    await page.goto("/en/courses/secure-checkout-e2e/enroll");

    await expect(
      page.getByRole("heading", { name: "Secure checkout course" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Create or sign in to a verified student account to continue",
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Email verification is required before secure enrollment.",
      ),
    ).toBeVisible();
    await expect(
      page
        .getByRole("dialog", { name: "Enroll in course" })
        .getByRole("link", { name: "Sign in", exact: true }),
    ).toHaveAttribute(
      "href",
      "/en/sign-in?redirect=%2Fen%2Fcourses%2Fsecure-checkout-e2e%2Fenroll",
    );
    await expect(
      page.getByRole("link", { name: "Create a student account" }),
    ).toBeVisible();
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    expect(checkoutRequests).toBe(0);
  });
});
