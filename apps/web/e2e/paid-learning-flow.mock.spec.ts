import {
  expect,
  test,
  type Browser,
  type Page,
  type Route,
} from "@playwright/test";

type Role = "student" | "tutor";

const lesson = {
  id: "lesson-paid-1",
  tutorId: "tutor-1",
  studentId: "student-1",
  scheduledTime: "2030-01-07T10:00:00.000Z",
  endTime: "2030-01-07T12:00:00.000Z",
  durationMinutes: 120,
  price: 100,
  status: "confirmed",
  sessionStatus: "confirmed",
  paymentStatus: "paid",
  timezone: "UTC",
  roomId: "live-room-1",
  meetUrl: "live-room-1",
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
};

const course = {
  id: "course-1",
  tutorId: "tutor-1",
  title: "Complete Arabic Conversation",
  subtitle: "Speak confidently with guided practice",
  description: "Video, files, links, and guided lessons in one course.",
  learningOutcomes: ["Build fluent conversations", "Use practical vocabulary"],
  price: 40,
  thumbnailUrl: null,
  tutor: {
    firstName: "Omar",
    lastName: "Saleh",
    avatarUrl: null,
  },
};

const curriculum = [
  {
    id: "course-lesson-1",
    title: "Welcome video and workbook",
    durationMinutes: 35,
    lessonOrder: 1,
    contentType: "video",
  },
  {
    id: "course-lesson-2",
    title: "Conversation resources",
    durationMinutes: 25,
    lessonOrder: 2,
    contentType: "resource",
  },
];

async function routeJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    contentType: "application/json",
    status,
    body: JSON.stringify(body),
  });
}

async function installPaidFlowMocks(page: Page, role: Role) {
  let balance = role === "student" ? 0 : 0;
  let paymentApproved = false;
  let booked = false;
  let enrolled = false;

  await page.context().addCookies([
    {
      name: "mrh_token",
      value: `paid-flow-${role}`,
      url: "http://127.0.0.1:3210",
      httpOnly: true,
      sameSite: "Strict",
    },
    {
      name: "mrh_csrf",
      value: "paid-flow-csrf",
      url: "http://127.0.0.1:3210",
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
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();

    if (pathname === "/api/v1/users/me") {
      return routeJson(
        route,
        role === "student"
          ? {
              id: "student-1",
              email: "student@mrh-academy.example",
              role: "student",
              firstName: "Mariam",
              lastName: "Hassan",
              avatarUrl: null,
              timezone: "UTC",
            }
          : {
              id: "tutor-1",
              email: "tutor@mrh-academy.example",
              role: "tutor",
              firstName: "Omar",
              lastName: "Saleh",
              avatarUrl: null,
              timezone: "UTC",
            },
      );
    }
    if (pathname === "/api/v1/students/balance") {
      return routeJson(route, { balance, egpRate: 50 });
    }
    if (pathname === "/api/v1/payment-methods") {
      return routeJson(route, [
        { type: "paypal", enabled: true, details: "PayPal" },
      ]);
    }
    if (pathname === "/api/v1/payments/history") {
      return routeJson(
        route,
        paymentApproved
          ? [
              {
                id: "payment-1",
                amount: 300,
                currency: "USD",
                method: "paypal",
                status: "approved",
                createdAt: "2030-01-01T00:00:00.000Z",
              },
            ]
          : [],
      );
    }
    if (pathname === "/api/v1/payments/submit" && method === "POST") {
      expect(request.postData() ?? "").toContain("paypal");
      return routeJson(route, {
        id: "payment-1",
        checkoutUrl:
          "http://127.0.0.1:3210/en/learn/wallet?paypalPaymentId=payment-1",
      });
    }
    if (
      pathname === "/api/v1/payments/paypal/payment-1/capture" &&
      method === "POST"
    ) {
      if (!paymentApproved) {
        paymentApproved = true;
        balance += 300;
      }
      return routeJson(route, { id: "payment-1", status: "approved" });
    }
    if (pathname === "/api/v1/tutors/tutor-1") {
      return routeJson(route, {
        userId: "tutor-1",
        bio: "A patient conversation specialist.",
        specialization: "Arabic conversation",
        languages: ["Arabic", "English"],
        hourlyRate: 50,
        averageRating: 4.9,
        reviewCount: 21,
        user: {
          firstName: "Omar",
          lastName: "Saleh",
          avatarUrl: null,
        },
      });
    }
    if (pathname === "/api/v1/tutors/tutor-1/availability") {
      return routeJson(
        route,
        Array.from({ length: 7 }, (_, dayOfWeek) => ({
          id: `slot-${dayOfWeek}`,
          dayOfWeek,
          startTime: "08:00:00",
          endTime: "18:00:00",
          isRecurring: true,
        })),
      );
    }
    if (pathname === "/api/v1/reviews/tutor/tutor-1") {
      return routeJson(route, []);
    }
    if (pathname === "/api/v1/lessons/book" && method === "POST") {
      const input = request.postDataJSON() as {
        durationMinutes: number;
        idempotencyKey: string;
      };
      expect(input.durationMinutes).toBe(120);
      expect(input.idempotencyKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      booked = true;
      balance -= 100;
      return routeJson(route, lesson, 201);
    }
    if (pathname === "/api/v1/tutor/availability") {
      return routeJson(route, []);
    }
    if (pathname === "/api/v1/lessons") {
      return routeJson(route, {
        data: booked || role === "tutor" ? [lesson] : [],
        total: booked || role === "tutor" ? 1 : 0,
        page: 1,
        totalPages: 1,
      });
    }
    if (pathname === "/api/v1/courses/course-1") {
      return routeJson(route, course);
    }
    if (pathname === "/api/v1/courses/course-1/curriculum") {
      return routeJson(route, curriculum);
    }
    if (pathname === "/api/v1/courses/my/enrollments") {
      return routeJson(
        route,
        enrolled
          ? [
              {
                id: "enrollment-1",
                courseId: "course-1",
                progressPercentage: 0,
              },
            ]
          : [],
      );
    }
    if (pathname === "/api/v1/courses/course-1/enroll" && method === "POST") {
      const input = request.postDataJSON() as { idempotencyKey: string };
      expect(input.idempotencyKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      enrolled = true;
      balance -= 40;
      return routeJson(route, {
        id: "enrollment-1",
        courseId: "course-1",
        duplicate: false,
      });
    }
    if (pathname === "/api/v1/courses/course-1/lessons") {
      return routeJson(
        route,
        enrolled
          ? curriculum.map((item) => ({
              ...item,
              isCompleted: false,
              articleContent:
                item.id === "course-lesson-2"
                  ? "Download the workbook and follow the tutor link."
                  : null,
              resourceUrl:
                item.id === "course-lesson-2"
                  ? "https://materials.example/workbook.pdf"
                  : null,
            }))
          : [],
      );
    }
    if (pathname === "/api/v1/lessons/by-room/live-room-1") {
      return routeJson(route, {
        ...lesson,
        access: {
          state: "allowed",
          canJoin: true,
          reason: "Classroom is open",
          opensAt: "2030-01-07T09:45:00.000Z",
          closesAt: "2030-01-07T12:15:00.000Z",
          serverTime: "2030-01-07T10:00:00.000Z",
        },
      });
    }
    if (pathname.includes("/playback") || pathname.includes("/stream-token")) {
      return routeJson(route, { message: "No preview uploaded" }, 404);
    }
    return routeJson(route, []);
  });
}

async function newRolePage(browser: Browser, role: Role) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await installPaidFlowMocks(page, role);
  return { context, page };
}

async function navigate(page: Page, pathname: string) {
  try {
    await page.goto(pathname, { waitUntil: "domcontentloaded" });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("ERR_ABORTED")) {
      throw error;
    }
  }
  await expect.poll(() => new URL(page.url()).pathname).toBe(pathname);
}

test("paid learning happy path covers wallet, booking, tutor visibility, classrooms, and course access", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const student = await newRolePage(browser, "student");
  await student.page.goto("/en/learn/wallet/add");
  await student.page.getByRole("button", { name: "PayPal" }).click();
  await student.page.getByLabel("Custom amount").fill("300");
  await student.page
    .getByRole("button", { name: "Confirm deposit of $300.00" })
    .click();
  await expect(student.page).toHaveURL(/paypalPaymentId=payment-1/);
  await expect(student.page).toHaveURL(/paypal=success/, { timeout: 30_000 });
  await student.page.reload();
  await expect(student.page.getByText("$300.00").first()).toBeVisible();

  await navigate(student.page, "/en/learn/tutors/tutor-1/book");
  await expect(
    student.page.getByRole("heading", { name: "Omar Saleh" }),
  ).toBeVisible();
  await expect(
    student.page.getByText("A patient conversation specialist."),
  ).toBeVisible();
  await student.page.getByLabel("Requested date").fill("2030-01-07");
  await student.page.getByLabel("Requested time").fill("10:00");
  await student.page.getByRole("button", { name: "2 hours" }).click();
  await expect(
    student.page.getByText("Total price").locator(".."),
  ).toContainText("$100.00");
  await student.page
    .getByRole("button", { name: "Book lesson ($100.00)" })
    .click();
  await expect(
    student.page.getByRole("heading", { name: "Lesson booked successfully" }),
  ).toBeVisible();

  await navigate(student.page, "/en/room/live-room-1");
  await expect(student.page.getByTestId("classroom-preflight")).toBeVisible();
  await student.page.getByTestId("join-classroom").click();
  await expect(student.page.getByTestId("classroom-shell")).toBeVisible();

  await navigate(student.page, "/en/learn/courses/catalog/course-1/enroll");
  await expect(
    student.page.getByRole("heading", { name: "Complete Arabic Conversation" }),
  ).toBeVisible();
  await expect(
    student.page.getByText("Welcome video and workbook"),
  ).toBeVisible();
  await expect(student.page.getByText("Conversation resources")).toBeVisible();
  await student.page.getByRole("button", { name: "Enroll for $40.00" }).click();
  await expect(
    student.page.getByRole("heading", {
      name: "Enrollment confirmed by the server",
    }),
  ).toBeVisible();
  await expect(
    student.page.getByRole("link", { name: "Start learning" }),
  ).toHaveAttribute("href", "/en/learn/courses/course-1");
  await navigate(student.page, "/en/learn/courses/course-1");
  await expect(
    student.page.getByRole("heading", { name: "Course Content" }),
  ).toBeVisible();
  await expect(
    student.page.getByText("Welcome video and workbook"),
  ).toBeVisible();

  const tutor = await newRolePage(browser, "tutor");
  await navigate(tutor.page, "/en/teach/schedule");
  await expect(
    tutor.page.getByRole("heading", { name: "Bookings & appointments" }),
  ).toBeVisible();
  await expect(tutor.page.getByText("Mariam Hassan")).toBeVisible();
  await expect(tutor.page.getByTestId("session-status")).toHaveText(
    "Confirmed",
  );

  await navigate(tutor.page, "/en/room/live-room-1");
  await expect(tutor.page.getByTestId("classroom-preflight")).toBeVisible();
  await tutor.page.getByTestId("join-classroom").click();
  await expect(tutor.page.getByTestId("classroom-shell")).toBeVisible();

  await Promise.all([student.context.close(), tutor.context.close()]);
});
