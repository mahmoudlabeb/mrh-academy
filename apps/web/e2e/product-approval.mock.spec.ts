import { expect, test, type Page, type Route } from "@playwright/test";

type QueueItem = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  courseType: "recorded" | "live";
  tutorName: string;
  submittedAt: string;
  price: number;
  language: string;
  category: string;
  status: "pending_review";
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockOperationsReview(page: Page) {
  await page.context().addCookies([
    {
      name: "mrh_token",
      value: "mock-admin-session",
      url: "http://127.0.0.1:3210",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  let queue: QueueItem[] = [
    {
      id: "recorded-pending",
      title: "Arabic conversation foundations",
      subtitle: "A practical recorded course for confident beginners",
      description:
        "A complete recorded course with guided exercises and structured practice.",
      courseType: "recorded",
      tutorName: "Mariam Hassan",
      submittedAt: "2026-07-30T09:00:00.000Z",
      price: 39,
      language: "Arabic",
      category: "Languages",
      status: "pending_review",
    },
    {
      id: "live-pending",
      title: "Live pronunciation clinic",
      subtitle: "Small-group feedback with a specialist tutor",
      description:
        "A focused live cohort for learners who need direct pronunciation feedback.",
      courseType: "live",
      tutorName: "Mariam Hassan",
      submittedAt: "2026-07-30T10:00:00.000Z",
      price: 55,
      language: "Arabic",
      category: "Languages",
      status: "pending_review",
    },
  ];
  const decisions: Array<{
    id: string;
    decision: "approved" | "rejected";
    note?: string;
  }> = [];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();
    if (pathname === "/api/v1/users/me") {
      return json(route, {
        id: "admin-1",
        email: "admin@mrh-academy.example",
        role: "admin",
        firstName: "Operations",
        lastName: "Lead",
        assignedPermissions: ["manage_courses"],
      });
    }
    if (pathname === "/api/v1/admin/stats") {
      return json(route, { pendingApplications: 0, openReports: 0 });
    }
    if (pathname === "/api/v1/admin/courses" && method === "GET") {
      return json(route, queue);
    }
    const detail = pathname.match(
      /^\/api\/v1\/admin\/courses\/([^/]+)\/review$/,
    );
    if (detail && method === "GET") {
      const item = queue.find((entry) => entry.id === detail[1]);
      if (!item) return json(route, { message: "Not found" }, 404);
      return json(route, {
        ...item,
        thumbnailUrl: null,
        learningOutcomes: ["Speak with clearer pronunciation"],
        requirements: ["Basic Arabic reading"],
        targetAudience: ["Arabic learners"],
        capacity: item.courseType === "live" ? 12 : null,
        timezone: "Africa/Cairo",
        cohortStartAt:
          item.courseType === "live" ? "2026-08-10T17:00:00.000Z" : null,
        cohortEndAt:
          item.courseType === "live" ? "2026-08-24T17:00:00.000Z" : null,
        tutor: {
          firstName: "Mariam",
          lastName: "Hassan",
          tutorProfile: {
            bio: "Arabic language educator focused on practical communication.",
            specialization: "Arabic conversation",
            languages: ["Arabic", "English"],
          },
        },
        sections: [
          {
            id: "section-1",
            title: item.courseType === "live" ? "Live agenda" : "Foundations",
            lessons: [
              {
                id: "lesson-1",
                sectionId: "section-1",
                title: "Welcome and first dialogue",
                contentType: "video",
                durationMinutes: 18,
                downloadableFiles: [
                  { id: "file-1", name: "Practice guide.pdf" },
                ],
                externalLinks: [],
              },
            ],
          },
        ],
      });
    }
    const approve = pathname.match(
      /^\/api\/v1\/admin\/courses\/([^/]+)\/approve$/,
    );
    if (approve && method === "POST") {
      decisions.push({ id: approve[1], decision: "approved" });
      queue = queue.filter((item) => item.id !== approve[1]);
      return json(route, { status: "active" });
    }
    const reject = pathname.match(
      /^\/api\/v1\/admin\/courses\/([^/]+)\/reject$/,
    );
    if (reject && method === "POST") {
      const body = request.postDataJSON() as { reason: string };
      decisions.push({
        id: reject[1],
        decision: "rejected",
        note: body.reason,
      });
      queue = queue.filter((item) => item.id !== reject[1]);
      return json(route, { status: "rejected", reviewNote: body.reason });
    }
    return json(route, []);
  });

  return { decisions: () => decisions };
}

async function mockRejectedTutorProduct(page: Page) {
  await page.context().addCookies([
    {
      name: "mrh_token",
      value: "mock-tutor-session",
      url: "http://127.0.0.1:3210",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  let status: "rejected" | "draft" = "rejected";
  const course = () => ({
    id: "rejected-course",
    tutorId: "tutor-1",
    title: "Professional Arabic writing",
    subtitle: "Write clear practical Arabic for work and study",
    description:
      "A structured course that develops practical written Arabic through guided assignments.",
    category: "languages",
    language: "Arabic",
    level: "intermediate",
    price: 45,
    courseType: "recorded" as const,
    thumbnailUrl: null,
    overviewVideoId: "overview-1",
    previewVideoUrl: null,
    learningOutcomes: ["Write clear professional messages"],
    requirements: ["Intermediate Arabic"],
    targetAudience: ["Arabic learners"],
    capacity: null,
    cohortStartAt: null,
    cohortEndAt: null,
    status,
    reviewNote: "Please replace the opening preview with a clearer audio track.",
    updatedAt: "2026-07-30T11:00:00.000Z",
  });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();
    if (pathname === "/api/v1/users/me") {
      return json(route, {
        id: "tutor-1",
        email: "tutor@mrh-academy.example",
        role: "tutor",
        firstName: "Mariam",
        lastName: "Hassan",
      });
    }
    if (pathname === "/api/v1/courses/my/courses") {
      return json(route, [course()]);
    }
    if (
      pathname === "/api/v1/courses/rejected-course/studio" &&
      method === "GET"
    ) {
      return json(route, {
        course: course(),
        sections: [],
        lessons: [],
        readiness: {
          ready: false,
          completed: 4,
          total: 5,
          progress: 80,
          items: [],
        },
      });
    }
    if (
      pathname === "/api/v1/courses/rejected-course/media/preview/status" &&
      method === "GET"
    ) {
      return json(route, { status: "ready", captions: [] });
    }
    if (
      pathname === "/api/v1/courses/rejected-course/revise" &&
      method === "POST"
    ) {
      status = "draft";
      return json(route, course());
    }
    if (pathname === "/api/v1/tutors/me/profile") {
      return json(route, {
        bio: "Arabic educator",
        specialization: "Arabic writing",
        user: { firstName: "Mariam", lastName: "Hassan" },
      });
    }
    return json(route, []);
  });

  return { status: () => status };
}

test("admin reviews recorded and live submissions with approve and reject decisions", async ({
  page,
}) => {
  const api = await mockOperationsReview(page);
  await page.goto("/ar/ops");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  const queue = page.getByTestId("product-review-queue");
  await expect(queue).toContainText("Arabic conversation foundations");
  await expect(queue).toContainText("Live pronunciation clinic");
  await expect(queue).toContainText("دورة مسجلة");
  await expect(queue).toContainText("عرض مباشر");

  await queue
    .getByRole("row", { name: /Arabic conversation foundations/ })
    .getByRole("button", { name: "فتح المراجعة" })
    .click();
  const drawer = page.getByRole("dialog", { name: /Arabic conversation foundations/ });
  await expect(drawer).toContainText("Mariam Hassan");
  await expect(drawer).toContainText("Welcome and first dialogue");
  await expect(drawer).toContainText("Practice guide.pdf");
  await drawer.getByTestId("review-approve").click();
  await expect(drawer).not.toBeVisible();

  await queue
    .getByRole("row", { name: /Live pronunciation clinic/ })
    .getByRole("button", { name: "فتح المراجعة" })
    .click();
  const liveDrawer = page.getByRole("dialog", { name: /Live pronunciation clinic/ });
  await expect(liveDrawer).toContainText("Africa/Cairo");
  await liveDrawer.getByRole("button", { name: "رفض مع ملاحظات" }).click();
  await liveDrawer
    .getByPlaceholder("اشرح التعديلات المطلوبة بوضوح…")
    .fill("أضف جدولاً أوضح وروابط اللقاءات المباشرة.");
  await liveDrawer.getByTestId("review-reject").click();

  await expect.poll(api.decisions).toEqual([
    { id: "recorded-pending", decision: "approved" },
    {
      id: "live-pending",
      decision: "rejected",
      note: "أضف جدولاً أوضح وروابط اللقاءات المباشرة.",
    },
  ]);
  await expect(queue).toContainText("لا توجد منتجات معلّقة");
});

test("rejected product stays visible to its tutor with feedback and can be revised", async ({
  page,
}) => {
  const api = await mockRejectedTutorProduct(page);
  await page.goto("/en/teach/courses");

  await expect(page.getByText("Changes needed").first()).toBeVisible();
  await expect(
    page.getByText(
      "Please replace the opening preview with a clearer audio track.",
    ),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Review feedback and revise" })
    .click();

  await expect(
    page.getByText("Review the academy team’s feedback"),
  ).toBeVisible();
  await page.getByTestId("revise-course").click();
  await expect.poll(api.status).toBe("draft");
  await expect(page.getByTestId("save-course-draft")).toBeVisible();
});
