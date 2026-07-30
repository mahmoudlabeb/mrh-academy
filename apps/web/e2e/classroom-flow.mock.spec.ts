import { expect, test, type Page } from "@playwright/test";

type AccessState =
  | "allowed"
  | "waiting"
  | "cancelled"
  | "refunded"
  | "expired"
  | "closed"
  | "unpaid";

async function mockClassroom(page: Page, state: AccessState) {
  await page.context().addCookies([
    {
      name: "mrh_token",
      value: "mock-student-session",
      url: "http://127.0.0.1:3210",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => new MediaStream(),
        getDisplayMedia: async () => new MediaStream(),
      },
    });
  });
  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/v1/users/me") {
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({
          id: "student-1",
          email: "student@mrh-academy.example",
          role: "student",
          firstName: "Mariam",
          lastName: "Hassan",
          avatarUrl: null,
        }),
      });
      return;
    }
    if (pathname.endsWith("/lessons/by-room/classroom-e2e")) {
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({
          id: "lesson-1",
          tutorId: "tutor-1",
          studentId: "student-1",
          scheduledTime: "2030-01-01T10:00:00.000Z",
          endTime: "2030-01-01T10:50:00.000Z",
          durationMinutes: 50,
          price: 40,
          status: state === "cancelled" ? "cancelled" : "confirmed",
          sessionStatus: state === "cancelled" ? "cancelled" : "confirmed",
          paymentStatus:
            state === "refunded" || state === "cancelled"
              ? "refunded"
              : state === "unpaid"
                ? "pending"
                : "paid",
          roomId: "classroom-e2e",
          meetUrl: "classroom-e2e",
          googleMeetUrl: null,
          tutor: {
            id: "tutor-1",
            firstName: "Omar",
            lastName: "Saleh",
            avatarUrl: null,
          },
          student: {
            id: "student-1",
            firstName: "Mariam",
            lastName: "Hassan",
            avatarUrl: null,
          },
          access: {
            state,
            canJoin: state === "allowed",
            reason:
              state === "waiting"
                ? "This classroom is not open yet"
                : `Classroom access is ${state}`,
            opensAt: "2030-01-01T09:45:00.000Z",
            closesAt: "2030-01-01T11:05:00.000Z",
            serverTime: "2030-01-01T09:30:00.000Z",
          },
        }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: "[]",
    });
  });
}

test("confirmed paid lesson reaches preflight, classroom controls, and leave flow", async ({
  page,
}, testInfo) => {
  await mockClassroom(page, "allowed");
  await page.goto("/en/room/classroom-e2e");

  await expect(page.getByTestId("classroom-preflight")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Lesson with Omar Saleh" }),
  ).toBeVisible();
  await page.getByTestId("join-classroom").click();
  await expect(page.getByTestId("classroom-shell")).toBeVisible();
  await expect(page.getByTestId("classroom-stage")).toBeVisible();
  await expect(page.getByTestId("classroom-dock")).toBeVisible();
  if (process.env.CLASSROOM_SCREENSHOT_DIR) {
    await page.screenshot({
      path: `${process.env.CLASSROOM_SCREENSHOT_DIR}/live-classroom-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }

  const microphone = page.getByRole("button", {
    name: /mute microphone|unmute microphone/i,
  });
  await microphone.click();
  await expect(microphone).toHaveAttribute("aria-pressed", "false");

  const camera = page.getByRole("button", {
    name: /turn camera off|turn camera on/i,
  });
  await camera.click();
  await expect(camera).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: /chat/i }).click();
  await expect(page.getByPlaceholder("Type a message...")).toBeVisible();

  await page.getByRole("button", { name: /leave classroom/i }).click();
  await expect(
    page.getByRole("heading", { name: "Leave the classroom?" }),
  ).toBeVisible();
});

for (const state of [
  "waiting",
  "cancelled",
  "refunded",
  "expired",
  "closed",
  "unpaid",
] as const) {
  test(`renders the ${state} classroom state without exposing join`, async ({
    page,
  }) => {
    await mockClassroom(page, state);
    await page.goto("/en/room/classroom-e2e");

    await expect(
      page.locator(
        `[data-testid="classroom-state"][data-access-state="${state}"]`,
      ),
    ).toBeVisible();
    await expect(page.getByTestId("join-classroom")).toHaveCount(0);
  });
}

test("renders denied access without requesting classroom media", async ({
  page,
}) => {
  let mediaRequests = 0;
  await mockClassroom(page, "allowed");
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          (
            window as typeof window & { __mediaRequests?: number }
          ).__mediaRequests =
            ((window as typeof window & { __mediaRequests?: number })
              .__mediaRequests ?? 0) + 1;
          return new MediaStream();
        },
      },
    });
  });
  await page.route("**/api/v1/lessons/by-room/classroom-e2e", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 403,
      body: JSON.stringify({
        statusCode: 403,
        message: "You are not a participant of this lesson",
      }),
    });
  });

  await page.goto("/en/room/classroom-e2e");

  await expect(
    page.locator('[data-testid="classroom-state"][data-access-state="denied"]'),
  ).toBeVisible();
  mediaRequests = await page.evaluate(
    () =>
      (window as typeof window & { __mediaRequests?: number })
        .__mediaRequests ?? 0,
  );
  expect(mediaRequests).toBe(0);
});

test("training classroom keeps the compact dock usable in RTL mobile layouts", async ({
  page,
}, testInfo) => {
  await mockClassroom(page, "allowed");
  await page.goto("/ar/learn/classroom/practice");

  await expect(
    page.getByRole("heading", { name: "اختبر الفصل" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const dock = page.getByTestId("classroom-dock");
  await expect(dock).toBeVisible();
  expect(
    await dock.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  if (process.env.CLASSROOM_SCREENSHOT_DIR) {
    await page.screenshot({
      path: `${process.env.CLASSROOM_SCREENSHOT_DIR}/training-classroom-ar-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }
});
