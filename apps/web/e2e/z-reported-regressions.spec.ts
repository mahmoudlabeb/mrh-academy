import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { readE2EFixtures } from "./helpers/fixtures";

let lessonId = "";
let roomId = "";
let studentId = "";
let tutorId = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  const databaseName = new URL(connectionString).pathname.slice(1);
  if (!/(^|[_-])(e2e|test)([_-]|$)/i.test(databaseName)) {
    throw new Error(
      `Refusing to seed browser regression data in ${databaseName}`,
    );
  }

  const fixtures = await readE2EFixtures();
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const users = await client.query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE email = ANY($1::text[])`,
      [[fixtures.roles.student.email, fixtures.roles.tutor.email]],
    );
    studentId =
      users.rows.find((user) => user.email === fixtures.roles.student.email)
        ?.id ?? "";
    tutorId =
      users.rows.find((user) => user.email === fixtures.roles.tutor.email)
        ?.id ?? "";
    if (!studentId || !tutorId)
      throw new Error("Browser fixture users are missing");

    lessonId = randomUUID();
    roomId = `regression-${randomUUID()}`;
    await client.query(
      `INSERT INTO lessons
        (id, tutor_id, student_id, scheduled_time, end_time, duration_minutes,
         price, platform_fee, status, room_id, meet_url, created_at, updated_at)
       VALUES ($1, $2, $3, now() + interval '5 minutes',
         now() + interval '30 minutes', 25, 0, 0, 'confirmed', $4, $4, now(), now())`,
      [lessonId, tutorId, studentId, roomId],
    );
  } finally {
    await client.end();
  }
});

test("tutor hero keeps accessible Focus contrast in both locales and viewports", async ({
  page,
}) => {
  await loginAs(page, "tutor");

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 375, height: 812 },
  ]) {
    await page.setViewportSize(viewport);
    for (const locale of ["en", "ar"]) {
      await page.goto(`/${locale}/teach`);
      const hero = page.locator(".blueprint-tutor-hero");
      await expect(hero).toBeVisible();

      const contrast = await hero.evaluate((element) => {
        const parseColor = (value: string) => {
          const channels = value.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
          return {
            rgb: channels.slice(0, 3),
            alpha: channels[3] ?? 1,
          };
        };
        const luminance = (channels: number[]) => {
          const linear = channels.map((channel) => {
            const normalized = channel / 255;
            return normalized <= 0.03928
              ? normalized / 12.92
              : ((normalized + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
        };
        const ratio = (foreground: string, background: string) => {
          const foregroundLuminance = luminance(parseColor(foreground).rgb);
          const backgroundLuminance = luminance(parseColor(background).rgb);
          return (
            (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
            (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
          );
        };

        const heroStyle = getComputedStyle(element);
        const background = parseColor(heroStyle.backgroundColor);
        const textRatios = Array.from(
          element.querySelectorAll<HTMLElement>(
            ".blueprint-kicker, h1, div > p:last-child",
          ),
          (text) =>
            ratio(getComputedStyle(text).color, heroStyle.backgroundColor),
        );
        const action = element.querySelector<HTMLElement>(".btn-primary");
        const actionStyle = action ? getComputedStyle(action) : null;

        return {
          backgroundAlpha: background.alpha,
          textRatios,
          actionRatio: actionStyle
            ? ratio(actionStyle.color, actionStyle.backgroundColor)
            : 0,
        };
      });

      expect(contrast.backgroundAlpha).toBeGreaterThan(0);
      expect(Math.min(...contrast.textRatios)).toBeGreaterThanOrEqual(4.5);
      expect(contrast.actionRatio).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("tutor can add availability and receives an exact overlap explanation", async ({
  page,
}) => {
  await loginAs(page, "tutor");
  await page.goto("/en/teach/schedule");

  await page.getByLabel("Day").selectOption("1");
  await page.getByLabel("Start").fill("09:00");
  await page.getByLabel("End").fill("12:00");
  await page.getByRole("button", { name: "Add hours" }).click();
  await expect(page.getByText(/Monday 09:00/)).toBeVisible();

  await page.getByLabel("Start").fill("10:00");
  await page.getByLabel("End").fill("11:00");
  await expect(page.getByText(/overlap 09:00/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Add hours" })).toBeDisabled();
});

test("student contact opens the shared message route and server confirms delivery", async ({
  page,
}) => {
  await loginAs(page, "tutor");
  await page.goto("/en/teach/students");
  await expect(
    page.getByRole("link", { name: "Availability" }),
  ).toHaveAttribute("href", "/en/teach/availability");
  await expect(page.getByRole("link", { name: "Profile" })).toHaveAttribute(
    "href",
    "/en/teach/profile",
  );
  await page.getByRole("button", { name: "Contact" }).click();
  await expect(page).toHaveURL(new RegExp(`/en/messages/${studentId}$`));

  const content = `Regression message ${randomUUID()}`;
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/messages"),
  );
  await page.getByPlaceholder("Type a message").fill(content);
  await page.getByRole("button", { name: "Send" }).click();
  expect((await responsePromise).ok()).toBe(true);
  await expect(page.getByRole("article").getByText(content)).toBeVisible();
});

test("the same confirmed native classroom is authorized for tutor and student", async ({
  browser,
}) => {
  const fixtures = await readE2EFixtures();
  const tutorContext = await browser.newContext();
  const studentContext = await browser.newContext();
  await tutorContext.addCookies(fixtures.roles.tutor.cookies);
  await studentContext.addCookies(fixtures.roles.student.cookies);

  try {
    const tutorPage = await tutorContext.newPage();
    const studentPage = await studentContext.newPage();
    const tutorLookup = tutorPage.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname.endsWith(`/lessons/by-room/${roomId}`),
    );
    const studentLookup = studentPage.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname.endsWith(`/lessons/by-room/${roomId}`),
    );

    await Promise.all([
      tutorPage.goto(`/en/room/${roomId}`),
      studentPage.goto(`/en/room/${roomId}`),
    ]);

    const tutorResponse = await tutorLookup;
    const studentResponse = await studentLookup;
    expect(
      tutorResponse.status(),
      `Tutor classroom lookup failed: ${await tutorResponse.text()}`,
    ).toBe(200);
    expect(
      studentResponse.status(),
      `Student classroom lookup failed: ${await studentResponse.text()}`,
    ).toBe(200);
    await expect(tutorPage.getByText("MRH native classroom")).toBeVisible();
    await expect(studentPage.getByText("MRH native classroom")).toBeVisible();
    await expect(
      tutorPage.getByRole("button", { name: "Join classroom" }),
    ).toBeVisible();
    await expect(
      studentPage.getByRole("button", { name: "Join classroom" }),
    ).toBeVisible();
  } finally {
    await tutorContext.close();
    await studentContext.close();
  }
});

test("legacy learner messages URL redirects and logout is visible and functional", async ({
  page,
}) => {
  await loginAs(page, "student");
  await page.goto("/ar/learn/messages");
  await expect(page).toHaveURL(/\/ar\/(?:learn\/)?messages$/);
  await expect(page.locator("body")).not.toContainText("404");
  await page.goto("/ar/learn");
  await expect(page.getByRole("link", { name: "المحفوظات" })).toHaveAttribute(
    "href",
    "/ar/learn/saved",
  );
  await expect(page.getByRole("link", { name: "المفردات" })).toHaveAttribute(
    "href",
    "/ar/learn/words",
  );
  await expect(
    page.getByRole("button", { name: "تسجيل الخروج" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
  await expect(page).toHaveURL(
    /^http:\/\/(?:127\.0\.0\.1|localhost):3000\/(?:en|ar)?$/,
  );
});
