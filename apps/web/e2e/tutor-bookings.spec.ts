import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { readE2EFixtures } from "./helpers/fixtures";

const lessonIds = [randomUUID(), randomUUID(), randomUUID()];
let tutorId = "";
const studentId = randomUUID();

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  const databaseName = new URL(connectionString).pathname.slice(1);
  if (!/(^|[_-])(e2e|test)([_-]|$)/i.test(databaseName)) {
    throw new Error(`Refusing to seed tutor booking data in ${databaseName}`);
  }

  const fixtures = await readE2EFixtures();
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const users = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1`,
      [fixtures.roles.tutor.email],
    );
    tutorId = users.rows[0]?.id ?? "";
    if (!tutorId) throw new Error("Browser tutor fixture is missing");

    await client.query(
      `UPDATE users SET timezone = 'Africa/Cairo' WHERE id = $1`,
      [tutorId],
    );
    await client.query(
      `INSERT INTO users
        (id, email, role, first_name, last_name, timezone, is_verified, is_active,
         created_at, updated_at)
       VALUES ($1, $2, 'student', 'Booking', 'Student', 'Africa/Cairo', true,
         true, now(), now())`,
      [studentId, `booking-${studentId}@mrh-academy.example`],
    );
    await client.query(
      `INSERT INTO student_profiles (user_id, balance, created_at, updated_at)
       VALUES ($1, 0, now(), now())`,
      [studentId],
    );
    await client.query(
      `INSERT INTO lessons
        (id, tutor_id, student_id, scheduled_time, end_time, duration_minutes,
         price, platform_fee, status, room_id, meet_url, created_at, updated_at)
       VALUES
        ($1, $3, $4, now() + interval '3 days',
         now() + interval '3 days 25 minutes', 25, 42.50, NULL, 'confirmed',
         $5, $5, now(), now()),
        ($2, $3, $4, now() + interval '4 days',
         now() + interval '4 days 50 minutes', 50, 60, NULL, 'confirmed',
         $6, $6, now(), now())`,
      [
        lessonIds[0],
        lessonIds[1],
        tutorId,
        studentId,
        `booking-${lessonIds[0]}`,
        `booking-${lessonIds[1]}`,
      ],
    );
  } finally {
    await client.end();
  }
});

test.afterAll(async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(`DELETE FROM users WHERE id = $1`, [studentId]);
  } finally {
    await client.end();
  }
});

test("assigned booking shows every required field and management action once", async ({
  page,
}) => {
  await loginAs(page, "tutor");
  await page.goto("/en/teach");

  const card = page.locator(
    `[data-testid="lesson-card"][data-lesson-id="${lessonIds[0]}"]`,
  );
  await expect(card).toHaveCount(1);
  await expect(card.getByTestId("lesson-student")).toContainText(
    "Booking Student",
  );
  await expect(card.getByTestId("lesson-date")).not.toBeEmpty();
  await expect(card.getByTestId("lesson-time")).not.toBeEmpty();
  await expect(card.getByTestId("lesson-timezone")).toHaveText("Africa/Cairo");
  await expect(card.getByTestId("lesson-duration")).toContainText("25 minutes");
  await expect(card.getByTestId("payment-status")).toHaveText("Paid");
  await expect(card.getByTestId("session-status")).toHaveText("Confirmed");
  await expect(card.getByTestId("join-lesson")).toBeVisible();
  await expect(card.getByTestId("reschedule-lesson")).toBeVisible();
  await expect(card.getByTestId("cancel-lesson")).toBeVisible();

  await card.getByTestId("reschedule-lesson").click();
  await expect(page.getByRole("dialog")).toContainText("Africa/Cairo");
  await expect(page.getByTestId("reschedule-datetime")).not.toHaveValue("");
  await page.getByRole("button", { name: "Close" }).click();
});

test("an open tutor dashboard picks up a new assigned booking promptly", async ({
  page,
}) => {
  await loginAs(page, "tutor");
  await page.goto("/en/teach");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const roomId = `booking-${lessonIds[2]}`;
    await client.query(
      `INSERT INTO lessons
        (id, tutor_id, student_id, scheduled_time, end_time, duration_minutes,
         price, platform_fee, status, room_id, meet_url, created_at, updated_at)
       VALUES ($1, $2, $3, now() + interval '5 days',
         now() + interval '5 days 25 minutes', 25, 35, NULL, 'confirmed',
         $4, $4, now(), now())`,
      [lessonIds[2], tutorId, studentId, roomId],
    );
  } finally {
    await client.end();
  }

  await expect(
    page.locator(
      `[data-testid="lesson-card"][data-lesson-id="${lessonIds[2]}"]`,
    ),
  ).toHaveCount(1, { timeout: 20_000 });
});

test("tutor cancellation is reflected as cancelled and refunded without a duplicate card", async ({
  page,
}) => {
  await loginAs(page, "tutor");
  await page.goto("/en/teach");

  const selector = `[data-testid="lesson-card"][data-lesson-id="${lessonIds[1]}"]`;
  await page.locator(selector).getByTestId("cancel-lesson").click();
  await expect(page.getByRole("dialog")).toContainText("full refund");
  await page.getByTestId("confirm-cancel").click();

  await page.getByRole("tab", { name: /History/ }).click();
  const historyCard = page.locator(selector);
  await expect(historyCard).toHaveCount(1);
  await expect(historyCard.getByTestId("payment-status")).toHaveText(
    "Refunded",
  );
  await expect(historyCard.getByTestId("session-status")).toHaveText(
    "Cancelled",
  );
  await expect(historyCard.getByTestId("join-lesson")).toHaveCount(0);
  await expect(historyCard.getByTestId("cancel-lesson")).toHaveCount(0);
});
