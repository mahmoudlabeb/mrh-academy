import { expect, test, type Page } from "@playwright/test";

async function mockSession(
  page: Page,
  role: "admin" | "student" | "tutor" = "student",
) {
  await page.context().addCookies([
    {
      name: "mrh_token",
      value: `mock-${role}-session`,
      url: "http://127.0.0.1:3210",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);

  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const body =
      pathname === "/api/v1/users/me"
        ? {
            id: `mock-${role}`,
            email: `${role}@mrh-academy.example`,
            role,
            firstName: "Demo",
            lastName: role[0].toUpperCase() + role.slice(1),
            avatarUrl: null,
          }
        : pathname === "/api/v1/tutors"
          ? [
              {
                userId: "tutor-1",
                bio: "A conversation specialist.",
                specialization: "Conversation",
                languages: ["Arabic", "English"],
                hourlyRate: 100,
                averageRating: 5,
                reviewCount: 8,
                user: {
                  firstName: "Premium",
                  lastName: "Tutor",
                  avatarUrl: null,
                },
              },
              {
                userId: "tutor-2",
                bio: "An affordable language coach.",
                specialization: "Foundations",
                languages: ["Arabic"],
                hourlyRate: 20,
                averageRating: 3,
                reviewCount: 2,
                user: {
                  firstName: "Budget",
                  lastName: "Tutor",
                  avatarUrl: null,
                },
              },
            ]
          : pathname === "/api/v1/tutors/tutor-1/availability"
            ? []
            : pathname === "/api/v1/tutors/tutor-1"
              ? {
                  userId: "tutor-1",
                  bio: "A conversation specialist.",
                  specialization: "Conversation",
                  languages: ["Arabic", "English"],
                  hourlyRate: 100,
                  averageRating: 5,
                  reviewCount: 8,
                  user: {
                    firstName: "Premium",
                    lastName: "Tutor",
                    avatarUrl: null,
                  },
                }
              : pathname === "/api/v1/students/balance"
                ? { balance: 235 }
                : pathname === "/api/v1/courses/course-1"
                  ? {
                      id: "course-1",
                      title: "Arabic Conversation Foundations",
                      description: "A focused conversation course.",
                      price: 40,
                      tutor: {
                        firstName: "Demo",
                        lastName: "Tutor",
                      },
                    }
                  : [];

    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify(body),
    });
  });
}

async function mockStudentSession(page: Page) {
  await mockSession(page, "student");
}

test("student tutor discovery stays inside the learner workspace", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await mockStudentSession(page);
  await page.goto("/en/learn");

  await page.getByRole("link", { name: "Find a tutor", exact: true }).click();

  await expect(page).toHaveURL(/\/en\/learn\/tutors$/);
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Find an Approved Tutor" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/en\/learn$/);

  await page.getByRole("link", { name: "Browse courses", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/learn\/courses#catalog$/);
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Approved Courses Catalog" }),
  ).toBeVisible();
  await expect(page.locator("#catalog")).toBeFocused();
  await expect(
    page.locator("#catalog").getByRole("button", { name: "Back" }),
  ).toHaveCount(0);
  await expect(
    page.locator("#catalog").getByRole("button", { name: "Forward" }),
  ).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("signed-in public marketplace URLs preserve intent in the workspace", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await mockStudentSession(page);

  await page.goto("/en");
  await expect(page).toHaveURL(/\/en\/learn$/);
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toBeVisible();

  await page.goto("/en/tutors?sort=price");
  await expect(page).toHaveURL(/\/en\/learn\/tutors\?sort=price$/);
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toBeVisible();
  await expect(
    page
      .locator(".blueprint-tutor-card")
      .first()
      .getByRole("heading", { level: 2 }),
  ).toHaveText("Budget Tutor");

  await page.goto("/en/tutors/tutor-1?day=2#availability");
  await expect(page).toHaveURL(
    /\/en\/learn\/tutors\/tutor-1\?day=2#availability$/,
  );
  await expect(
    page.getByRole("heading", { name: "Premium Tutor" }),
  ).toBeVisible();

  await page.goto("/en/courses?sort=price");
  await expect(page).toHaveURL(/\/en\/learn\/courses\?sort=price#catalog$/);
  await expect(page.locator("#catalog")).toBeFocused();

  await page.goto("/en/courses/course-1/enroll");
  await expect(page).toHaveURL(
    /\/en\/learn\/courses\/catalog\/course-1\/enroll$/,
  );
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("same-page course catalog links move focus without history controls", async ({
  page,
}) => {
  await mockStudentSession(page);
  await page.goto("/en/learn/courses");

  await page
    .getByRole("link", { name: "Browse Course Catalog", exact: true })
    .click();

  await expect(page).toHaveURL(/\/en\/learn\/courses#catalog$/);
  await expect(page.locator("#catalog")).toBeFocused();
  await expect(
    page.locator("#catalog").getByRole("button", { name: "Back" }),
  ).toHaveCount(0);
  await expect(
    page.locator("#catalog").getByRole("button", { name: "Forward" }),
  ).toHaveCount(0);
});

test("Arabic learner discovery preserves RTL and the selected theme", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await mockStudentSession(page);

  await page.goto("/ar/learn");
  const findTutor = page.getByRole("link", {
    name: "اعثر على معلم",
    exact: true,
  });
  await expect(findTutor).toHaveAttribute("href", "/ar/learn/tutors");
  await page.goto("/ar/learn/tutors");

  await expect(page).toHaveURL(/\/ar\/learn\/tutors$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(
    page.getByRole("navigation", { name: "تنقل مساحة العمل" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "اعثر على معلم معتمد" }),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("signed-in tutors return to the teaching workspace from guest routes", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await mockSession(page, "tutor");

  await page.goto("/en/sign-in");
  await expect(page).toHaveURL(/\/en\/teach$/);
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toBeVisible();

  await page.goto("/en/tutors");
  await expect(page).toHaveURL(/\/en\/teach$/);
  expect(pageErrors).toEqual([]);
});

test("an expired session can reach sign in without a redirect loop", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "mrh_token",
      value: "expired-session",
      url: "http://localhost:3210",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    await route.fulfill({
      contentType: "application/json",
      status:
        pathname === "/api/v1/users/me" || pathname === "/api/v1/auth/refresh"
          ? 401
          : 200,
      body: JSON.stringify({ message: "Expired session" }),
    });
  });

  await page.goto("/en/sign-in");

  await expect(page).toHaveURL(/\/en\/sign-in$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
});
