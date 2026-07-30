import { expect, test, type Page, type Route } from "@playwright/test";

type DraftCourse = {
  id: string;
  tutorId: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  language: string;
  level: string;
  price: number;
  courseType: "recorded" | "live";
  thumbnailUrl: string | null;
  overviewVideoId: string | null;
  previewVideoUrl: string | null;
  learningOutcomes: string[];
  requirements: string[];
  targetAudience: string[];
  capacity: number | null;
  cohortStartAt: string | null;
  cohortEndAt: string | null;
  isDraft: boolean;
  status: "pending" | "approved" | "rejected";
  updatedAt: string;
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockTutorStudio(page: Page) {
  await page.context().addCookies([
    {
      name: "mrh_token",
      value: "mock-tutor-session",
      url: "http://127.0.0.1:3210",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  let course: DraftCourse = {
    id: "course-draft",
    tutorId: "mock-tutor",
    title: "",
    subtitle: "",
    description: "",
    category: "",
    language: "Arabic",
    level: "beginner",
    price: 0,
    courseType: "recorded",
    thumbnailUrl: null,
    overviewVideoId: null,
    previewVideoUrl: null,
    learningOutcomes: [],
    requirements: [],
    targetAudience: [],
    capacity: null,
    cohortStartAt: null,
    cohortEndAt: null,
    isDraft: true,
    status: "pending",
    updatedAt: new Date().toISOString(),
  };
  let draftCreated = false;
  let sections: Array<{
    id: string;
    title: string;
    description: null;
    sectionOrder: number;
  }> = [];
  let lessons: Array<{
    id: string;
    sectionId: string;
    title: string;
    description: string | null;
    contentType: "video" | "article" | "resource";
    videoAssetId: null;
    videoUrl: string | null;
    articleContent: string | null;
    resourceUrl: string | null;
    downloadableFiles: [];
    externalLinks: [];
    durationMinutes: number;
    lessonOrder: number;
    isPreview: boolean;
  }> = [];
  let promoUploaded = false;
  let submitted = false;

  function completeChecks() {
    const basics =
      course.title.length >= 10 &&
      course.subtitle.length >= 20 &&
      course.description.length >= 100 &&
      Boolean(course.category);
    const audience =
      course.learningOutcomes.length > 0 &&
      course.requirements.length > 0 &&
      course.targetAudience.length > 0;
    const curriculum =
      sections.length > 0 && lessons.some((lesson) => Boolean(lesson.videoUrl));
    const media = Boolean(course.thumbnailUrl && promoUploaded);
    const pricing = course.price >= 0;
    const items = [
      { key: "basics", label: "basics", complete: basics },
      { key: "audience", label: "audience", complete: audience },
      { key: "curriculum", label: "curriculum", complete: curriculum },
      { key: "media", label: "media", complete: media },
      { key: "pricing", label: "pricing", complete: pricing },
    ];
    return {
      ready: items.every((item) => item.complete),
      completed: items.filter((item) => item.complete).length,
      total: items.length,
      progress: Math.round(
        (items.filter((item) => item.complete).length / items.length) * 100,
      ),
      items,
    };
  }

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();
    if (pathname === "/api/v1/users/me") {
      return json(route, {
        id: "mock-tutor",
        email: "tutor@mrh-academy.example",
        role: "tutor",
        firstName: "Mariam",
        lastName: "Hassan",
        avatarUrl: null,
      });
    }
    if (pathname === "/api/v1/courses/drafts" && method === "POST") {
      draftCreated = true;
      return json(route, course, 201);
    }
    if (pathname === "/api/v1/courses/my/courses") {
      return json(route, draftCreated ? [course] : []);
    }
    if (
      pathname === "/api/v1/courses/course-draft/studio" &&
      method === "GET"
    ) {
      return json(route, {
        course,
        sections,
        lessons,
        readiness: completeChecks(),
      });
    }
    if (
      pathname === "/api/v1/courses/course-draft/media/preview/status" &&
      method === "GET"
    ) {
      return json(route, {
        status: promoUploaded ? "processing" : "missing",
        captions: [],
      });
    }
    if (pathname === "/api/v1/courses/course-draft" && method === "PATCH") {
      course = {
        ...course,
        ...(request.postDataJSON() as Partial<DraftCourse>),
        updatedAt: new Date().toISOString(),
      };
      return json(route, course);
    }
    if (
      pathname === "/api/v1/courses/course-draft/sections" &&
      method === "POST"
    ) {
      const body = request.postDataJSON() as { title: string };
      const section = {
        id: "section-1",
        title: body.title,
        description: null,
        sectionOrder: 1,
      };
      sections = [section];
      return json(route, section, 201);
    }
    if (
      pathname === "/api/v1/courses/course-draft/lessons" &&
      method === "POST"
    ) {
      const body = request.postDataJSON() as {
        sectionId: string;
        title: string;
        videoUrl: string;
        durationMinutes: number;
        isPreview: boolean;
      };
      const lesson = {
        id: "lesson-1",
        sectionId: body.sectionId,
        title: body.title,
        description: null,
        contentType: "video" as const,
        videoAssetId: null,
        videoUrl: body.videoUrl,
        articleContent: null,
        resourceUrl: null,
        downloadableFiles: [] as [],
        externalLinks: [] as [],
        durationMinutes: body.durationMinutes,
        lessonOrder: 1,
        isPreview: body.isPreview,
      };
      lessons = [lesson];
      return json(route, lesson, 201);
    }
    if (
      pathname === "/api/v1/courses/course-draft/media/cover" &&
      method === "POST"
    ) {
      course = {
        ...course,
        thumbnailUrl: "https://cdn.example/course-cover.webp",
      };
      return json(route, { url: course.thumbnailUrl }, 201);
    }
    if (
      pathname === "/api/v1/courses/course-draft/media/preview" &&
      method === "POST"
    ) {
      promoUploaded = true;
      course = { ...course, overviewVideoId: "promo-video" };
      return json(route, { status: "processing", captions: [] }, 201);
    }
    if (
      pathname === "/api/v1/courses/course-draft/submit" &&
      method === "POST"
    ) {
      if (!completeChecks().ready)
        return json(route, { message: "Course is not ready for review" }, 400);
      submitted = true;
      course = { ...course, isDraft: false, status: "pending" };
      return json(route, {
        ...course,
        message: "Course submitted for academy review",
      });
    }
    if (pathname === "/api/v1/tutors/me/profile") {
      return json(route, {
        bio: "Arabic language educator focused on practical communication.",
        specialization: "Arabic conversation",
        user: {
          firstName: "Mariam",
          lastName: "Hassan",
          avatarUrl: null,
        },
      });
    }
    return json(route, []);
  });

  return {
    wasSubmitted: () => submitted,
  };
}

test("tutor creates, completes, previews, and submits a course draft", async ({
  page,
}) => {
  const studio = await mockTutorStudio(page);
  await page.goto("/en/teach/courses/new/studio");

  const workspaceNav = page.getByRole("navigation", {
    name: "Workspace navigation",
  });
  await expect(workspaceNav).toBeVisible();
  await expect(
    workspaceNav.getByRole("link", { name: "Home" }),
  ).toHaveAttribute("href", "/en/teach");
  await expect(
    workspaceNav.getByRole("link", { name: "Courses" }),
  ).toHaveAttribute("href", "/en/teach/courses");
  await expect(
    workspaceNav.getByRole("link", { name: "Earnings" }),
  ).toHaveAttribute("href", "/en/teach/earnings");

  await page.getByTestId("create-course-draft").click();
  await expect(page).toHaveURL(/\/en\/teach\/courses\/course-draft\/studio/);
  await expect(page.getByTestId("submit-course")).toBeDisabled();

  await page
    .getByTestId("course-title")
    .fill("Arabic conversation for confident beginners");
  await page
    .getByTestId("course-subtitle")
    .fill("Build practical speaking confidence through guided practice");
  await page
    .getByTestId("course-description")
    .fill(
      "A practical Arabic course with guided conversations, focused exercises, useful vocabulary, and clear progress milestones for independent learners.",
    );
  await page.getByTestId("course-category").selectOption("languages");
  await page.getByTestId("save-course-draft").click();
  await expect(page.getByText(/Saved/)).toBeVisible();

  await page.getByRole("button", { name: /Audience and outcomes/ }).click();
  const outcomes = page.getByTestId("learning-outcomes");
  await outcomes
    .getByRole("textbox")
    .fill("Hold an everyday Arabic conversation");
  await outcomes.getByRole("button", { name: "Add outcome" }).click();
  const requirements = page.getByTestId("course-requirements");
  await requirements
    .getByRole("textbox")
    .fill("No previous Arabic experience is required");
  await requirements.getByRole("button", { name: "Add requirement" }).click();
  const audience = page.getByTestId("target-audience");
  await audience
    .getByRole("textbox")
    .fill("Beginner Arabic learners who want speaking practice");
  await audience.getByRole("button", { name: "Add audience" }).click();
  await page.getByTestId("save-course-draft").click();

  await page.getByRole("button", { name: /Curriculum/ }).click();
  await page.getByTestId("section-title").fill("Conversation foundations");
  await page.getByTestId("add-section").click();
  await expect(page.getByText("Conversation foundations")).toBeVisible();
  await page.getByRole("button", { name: "Add lesson" }).click();
  await page.getByTestId("lesson-title").fill("Welcome and first dialogue");
  await page
    .getByTestId("lesson-video-url")
    .fill("https://video.example/welcome");
  await page.getByTestId("save-lesson").click();
  await expect(page.getByText("Welcome and first dialogue")).toBeVisible();

  await page.getByRole("button", { name: /Course media/ }).click();
  await page.getByTestId("course-cover-input").setInputFiles({
    name: "cover.webp",
    mimeType: "image/webp",
    buffer: Buffer.alloc(2048, 1),
  });
  const videoStudio = page.getByTestId("course-video-uploader");
  await videoStudio.locator('input[accept*=".mp4"]').setInputFiles({
    name: "promo.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.alloc(4096, 2),
  });
  await expect(videoStudio.getByRole("status")).toContainText("Upload secured");

  await page.getByRole("button", { name: /Pricing/ }).click();
  await page.getByTestId("course-price").fill("39");
  await page.getByTestId("save-course-draft").click();

  await expect(
    page.getByRole("button", { name: /Review and submit/ }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /Review and submit/ }).click();
  await page.getByRole("button", { name: "Preview student page" }).click();
  await expect(page).toHaveURL(/\/en\/teach\/courses\/course-draft\/preview/);
  await expect(page.getByTestId("course-student-preview")).toContainText(
    "Arabic conversation for confident beginners",
  );
  await expect(page.getByText("Conversation foundations")).toBeVisible();
  await expect(page.getByText("$39.00")).toBeVisible();

  await page.getByRole("link", { name: "Back to editing" }).click();
  await page.getByTestId("submit-course").click();
  await expect.poll(studio.wasSubmitted).toBe(true);
  await expect(page.getByText("Course is under review")).toBeVisible();
});
