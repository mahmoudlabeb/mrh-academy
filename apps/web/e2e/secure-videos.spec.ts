import { expect, test, type Page } from "@playwright/test";

const tutorUser = {
  id: "tutor-video-e2e",
  email: "video.tutor@mrh-academy.example",
  firstName: "Mariam",
  lastName: "Hassan",
  phone: null,
  timezone: "Africa/Cairo",
  avatarUrl: null,
  role: "tutor",
  tutorProfile: { status: "approved" },
};

async function mockSession(page: Page) {
  await page.route("**/api/v1/users/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(tutorUser),
    }),
  );
  await page.route("**/api/v1/auth/csrf", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Set-Cookie": "mrh_csrf=secure-video-e2e; Path=/" },
      body: JSON.stringify({ csrfToken: "secure-video-e2e" }),
    }),
  );
}

test.describe("secure tutor and course videos", () => {
  test("validates uploads, exposes progress, and retries without reselecting", async ({
    page,
  }) => {
    await mockSession(page);
    let uploadAttempts = 0;
    let status: "ready" | "processing" = "ready";

    await page.route(
      "**/api/v1/tutors/me/profile/video/status",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status,
            embedUrl: status === "ready" ? "/e2e-current-player" : undefined,
            expiresAt: status === "ready" ? Date.now() + 600_000 : undefined,
            captions: [],
          }),
        }),
    );
    await page.route("**/e2e-current-player", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<title>Current secure video</title>",
      }),
    );
    await page.route("**/api/v1/tutors/me/profile/video", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      uploadAttempts += 1;
      await new Promise((resolve) => setTimeout(resolve, 350));
      if (uploadAttempts === 1) {
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "Temporary storage interruption" }),
        });
      }
      status = "processing";
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ status: "processing", captions: [] }),
      });
    });

    await page.goto("/en/teach/profile");
    const studio = page.getByTestId("tutor-video-uploader");
    await expect(studio).toBeVisible();
    const videoInput = studio.locator('input[type="file"][accept*=".mp4"]');

    await videoInput.setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a video"),
    });
    await expect(studio.getByRole("alert")).toContainText(
      "Choose a valid MP4, WebM, or MOV file.",
    );
    expect(uploadAttempts).toBe(0);

    await videoInput.setInputFiles({
      name: "tutor-introduction.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.alloc(32 * 1024, 1),
    });
    await expect(studio.getByRole("progressbar")).toBeVisible();
    await expect(
      studio.getByText(
        "Replacement preview · current video stays saved until upload succeeds",
      ),
    ).toBeVisible();
    await expect(studio.getByText("Temporary storage interruption")).toBeVisible();
    await expect(studio.getByText("tutor-introduction.mp4")).toBeVisible();

    await studio.getByRole("button", { name: "Retry upload" }).click();
    await expect(
      studio.getByText(
        "Upload secured. The video is now processing for playback.",
      ),
    ).toBeVisible();
    expect(uploadAttempts).toBe(2);
  });

  test("confirms deletion and manages WebVTT captions", async ({ page }) => {
    await mockSession(page);
    let deleted = false;
    let captions = [{ language: "en", label: "English" }];
    await page.route(
      "**/api/v1/tutors/me/profile/video/status",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            deleted
              ? { status: "missing", captions: [] }
              : {
                  status: "ready",
                  embedUrl: "/e2e-secure-player",
                  expiresAt: Date.now() + 600_000,
                  captions,
                },
          ),
        }),
    );
    await page.route(
      "**/api/v1/tutors/me/profile/video/captions/**",
      (route) => {
        captions = [];
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ deleted: true }),
        });
      },
    );
    await page.route(
      "**/api/v1/tutors/me/profile/video/captions",
      (route) => {
        captions = [...captions, { language: "ar", label: "العربية" }];
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ language: "ar", label: "العربية" }),
        });
      },
    );
    await page.route("**/api/v1/tutors/me/profile/video", (route) => {
      if (route.request().method() !== "DELETE") return route.continue();
      deleted = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ deleted: true }),
      });
    });
    await page.route("**/e2e-secure-player", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<title>Secure video controls</title>",
      }),
    );

    await page.goto("/en/teach/profile");
    const studio = page.getByTestId("tutor-video-uploader");
    await expect(studio.getByTestId("video-captions-notice")).toContainText(
      "English",
    );
    await studio.locator('input[accept*=".vtt"]').setInputFiles({
      name: "arabic.vtt",
      mimeType: "text/vtt",
      buffer: Buffer.from("WEBVTT\n\n00:00.000 --> 00:01.000\nمرحبا"),
    });
    await expect(studio.getByRole("status")).toContainText("Captions added.");

    await studio.getByRole("button", { name: "Delete video" }).click();
    await expect(studio.getByText("Delete permanently?")).toBeVisible();
    await studio.getByRole("button", { name: "Confirm delete" }).click();
    await expect(studio.getByRole("status")).toContainText("Video deleted.");
  });

  test("replaces the course URL field with the secure overview uploader", async ({
    page,
  }) => {
    await mockSession(page);
    let uploaded = false;
    await page.route("**/api/v1/courses/my/courses", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "course-draft",
            title: "Confident Arabic",
            description:
              "A practical course for confident everyday Arabic conversations.",
            price: 45,
            status: "pending",
            referralCode: "VIDEO-E2E",
            courseType: "recorded",
            learningOutcomes: ["Speak with confidence"],
            language: "Arabic",
            level: "Beginner",
            isDraft: true,
          },
        ]),
      }),
    );
    await page.route("**/api/v1/courses/course-draft/lessons", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      }),
    );
    await page.route(
      "**/api/v1/courses/course-draft/media/preview/status",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: uploaded ? "processing" : "missing",
            captions: [],
          }),
        }),
    );
    await page.route(
      "**/api/v1/courses/course-draft/media/preview",
      (route) => {
        if (route.request().method() !== "POST") return route.continue();
        uploaded = true;
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ status: "processing", captions: [] }),
        });
      },
    );

    await page.goto("/en/teach/courses/course-draft/studio");
    await page
      .getByRole("button", { name: "Landing page & banner" })
      .click();
    const studio = page.getByTestId("course-video-uploader");
    await expect(studio).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Introduction video URL" }),
    ).toHaveCount(0);

    await studio.locator('input[type="file"][accept*=".mp4"]').setInputFiles({
      name: "course-overview.webm",
      mimeType: "video/webm",
      buffer: Buffer.alloc(24 * 1024, 2),
    });
    await expect(studio.getByRole("status")).toContainText(
      "Upload secured. The video is now processing for playback.",
    );
  });

  test("uses signed public playback with caption metadata", async ({ page }) => {
    await mockSession(page);
    await page.route("**/api/v1/tutors/tutor-public/video/playback", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ready",
          embedUrl: "/e2e-public-player",
          expiresAt: Date.now() + 600_000,
          captions: [{ language: "en", label: "English" }],
        }),
      }),
    );
    await page.route("**/api/v1/tutors/tutor-public", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          userId: "tutor-public",
          bio: "A patient language tutor.",
          specialization: "Arabic conversation",
          languages: ["Arabic", "English"],
          hourlyRate: 25,
          averageRating: 4.9,
          user: { firstName: "Mariam", lastName: "Hassan" },
        }),
      }),
    );
    await page.route("**/api/v1/reviews/tutor/tutor-public", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
    );
    await page.route(
      "**/api/v1/tutors/tutor-public/availability",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "[]",
        }),
    );
    await page.route("**/e2e-public-player", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<title>Signed Bunny player</title>",
      }),
    );

    await page.goto("/en/tutors/tutor-public");
    const player = page.getByTestId("public-tutor-video");
    await expect(player.locator("iframe")).toHaveAttribute(
      "title",
      "Mariam Hassan tutor introduction",
    );
    await expect(player.getByTestId("video-captions-notice")).toContainText(
      "Captions available: English",
    );
    await expect(player.locator("iframe")).not.toHaveAttribute(
      "src",
      /video\.bunnycdn\.com/,
    );
  });

  test("keeps the Arabic course player usable on mobile in both themes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSession(page);
    await page.route(
      "**/api/v1/courses/course-video/overview/playback",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: "ready",
            embedUrl: "/e2e-course-player",
            expiresAt: Date.now() + 600_000,
            captions: [{ language: "ar", label: "العربية" }],
          }),
        }),
    );
    await page.route("**/api/v1/courses/course-video", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "course-video",
          title: "العربية للمحادثة",
          description: "دورة عملية لبناء الثقة في المحادثات اليومية.",
          price: 45,
          learningOutcomes: ["التحدث بثقة"],
          tutor: { firstName: "مريم", lastName: "حسن" },
        }),
      }),
    );
    await page.route("**/e2e-course-player", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<title>مشغل آمن</title>",
      }),
    );

    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await page.goto("/ar/courses/course-video");
    const player = page.getByTestId("public-course-video");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(player).toBeVisible();
    await expect
      .poll(async () => (await player.boundingBox())?.width ?? 0)
      .toBeGreaterThan(300);
    await expect
      .poll(async () => (await player.boundingBox())?.width ?? 500)
      .toBeLessThanOrEqual(390);

    await page.evaluate(() => localStorage.setItem("theme", "light"));
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(player.locator("iframe")).toBeVisible();
    await expect(player.getByTestId("video-captions-notice")).toContainText(
      "العربية",
    );
  });
});
