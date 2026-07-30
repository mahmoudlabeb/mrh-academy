import { expect, test, type Page, type Request } from "@playwright/test";

type PayoutOption = {
  method: string;
  detailType: "email" | "account_details";
};

const transactions = [
  {
    id: "lesson:lesson-1",
    type: "lesson_earning",
    amount: 120,
    status: "completed",
    description: "Lesson with Demo Student",
    createdAt: "2026-07-28T10:00:00.000Z",
  },
  {
    id: "course:course-1",
    type: "course_earning",
    amount: 80,
    status: "completed",
    description: "Course sale: Arabic Foundations",
    createdAt: "2026-07-27T10:00:00.000Z",
  },
  {
    id: "payout:payout-1",
    type: "payout",
    amount: -50,
    status: "processing",
    description: "Payout via paypal",
    createdAt: "2026-07-26T10:00:00.000Z",
  },
];

const payouts = [
  {
    id: "payout-1",
    amount: 50,
    method: "paypal",
    accountDetails:
      "long-payout-destination-address-for-responsive-layout@mrh-academy.example",
    status: "processing",
    createdAt: "2026-07-26T10:00:00.000Z",
  },
];

async function mockTutorFinancials(
  page: Page,
  options: PayoutOption[],
  onPayout?: (request: Request) => void,
  optionsInitiallyAvailable = true,
) {
  let optionsAvailable = optionsInitiallyAvailable;
  await page.context().addCookies([
    {
      name: "mrh_token",
      value: "mock-tutor-session",
      url: "http://127.0.0.1:3210",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/v1/payouts" && request.method() === "POST") {
      onPayout?.(request);
      await route.fulfill({
        contentType: "application/json",
        status: 201,
        body: JSON.stringify({
          id: "payout-new",
          amount: 75,
          method: "paypal",
          status: "processing",
        }),
      });
      return;
    }
    if (pathname === "/api/v1/payouts/options" && !optionsAvailable) {
      await route.fulfill({
        contentType: "application/json",
        status: 503,
        body: JSON.stringify({ message: "Payout options unavailable" }),
      });
      return;
    }

    const body =
      pathname === "/api/v1/users/me"
        ? {
            id: "mock-tutor",
            email: "tutor@mrh-academy.example",
            role: "tutor",
            firstName: "Demo",
            lastName: "Tutor",
            avatarUrl: null,
          }
        : pathname === "/api/v1/tutors/me/profile"
          ? { userId: "mock-tutor", balance: 420 }
          : pathname === "/api/v1/payouts/my/transactions"
            ? transactions
            : pathname === "/api/v1/payouts/my"
              ? payouts
              : pathname === "/api/v1/payouts/options"
                ? options
                : [];

    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify(body),
    });
  });

  return {
    setOptionsAvailable(value: boolean) {
      optionsAvailable = value;
    },
  };
}

test("earnings overview focuses on useful totals without Stripe Connect", async ({
  page,
}) => {
  await mockTutorFinancials(page, [
    { method: "bank_transfer", detailType: "account_details" },
  ]);
  await page.goto("/en/teach/earnings", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: "Earnings & Payouts" }),
  ).toBeVisible();
  await expect(page.getByText("Available for payout")).toBeVisible();
  await expect(page.getByText("Pending withdrawals")).toBeVisible();
  await expect(page.getByText("Total earnings")).toBeVisible();
  await expect(page.getByText("$200.00")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Earnings history" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Payout transfer history" }),
  ).toBeVisible();
  await expect(page.getByText("Stripe Connect")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Connect Stripe" }),
  ).toHaveCount(0);
});

test("enabled PayPal is primary and a tutor can request a payout", async ({
  page,
}) => {
  let submittedBody: Record<string, unknown> | undefined;
  await mockTutorFinancials(
    page,
    [
      { method: "bank_transfer", detailType: "account_details" },
      { method: "paypal", detailType: "email" },
    ],
    (request) => {
      submittedBody = request.postDataJSON() as Record<string, unknown>;
    },
  );
  await page.goto("/en/teach/earnings/payout", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("button", { name: "PayPal" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByLabel("Payout amount (USD)").fill("75");
  await page.getByLabel("PayPal email").fill("tutor@mrh-academy.example");
  await page.getByRole("button", { name: "Request payout of $75.00" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Payout request received by the server",
    }),
  ).toBeVisible();
  expect(submittedBody).toMatchObject({
    amount: 75,
    method: "paypal",
    paypalEmail: "tutor@mrh-academy.example",
  });
  expect(submittedBody).not.toHaveProperty("accountDetails");
  expect(submittedBody?.idempotencyKey).toEqual(expect.any(String));
});

test("missing payout details show a professional accessible setup message", async ({
  page,
}) => {
  await mockTutorFinancials(page, [
    { method: "bank_transfer", detailType: "account_details" },
  ]);
  await page.goto("/en/teach/earnings/payout", {
    waitUntil: "domcontentloaded",
  });

  await page.getByLabel("Payout amount (USD)").fill("75");
  await page.getByRole("button", { name: "Request payout of $75.00" }).click();

  await expect(
    page.getByRole("alert").filter({
      hasText: "Add valid account details to complete your payout setup.",
    }),
  ).toBeVisible();
});

test("payout options errors are distinct and can be retried", async ({
  page,
}) => {
  const controls = await mockTutorFinancials(
    page,
    [{ method: "bank_transfer", detailType: "account_details" }],
    undefined,
    false,
  );
  await page.goto("/en/teach/earnings/payout", {
    waitUntil: "domcontentloaded",
  });

  const loadError = page
    .getByRole("alert")
    .filter({ hasText: "Payout methods could not be loaded" });
  await expect(loadError).toContainText("Payout methods could not be loaded");
  await expect(loadError).toContainText("No financial data was changed.");

  controls.setOptionsAvailable(true);
  await loadError.getByRole("button", { name: "Retry" }).click();

  await expect(
    page.getByRole("button", { name: "Bank transfer" }),
  ).toBeVisible();
  await expect(page.getByText("Payout setup is not available")).toHaveCount(0);
});

test("payout history remains horizontally accessible at 375px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await mockTutorFinancials(page, [
    { method: "bank_transfer", detailType: "account_details" },
  ]);
  await page.goto("/en/teach/earnings", { waitUntil: "domcontentloaded" });

  const history = page.getByRole("region", {
    name: "Payout transfer history table",
  });
  await expect(history).toBeVisible();
  await expect(history).toHaveCSS("overflow-x", "auto");
  const dimensions = await history.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.clientWidth).toBeLessThanOrEqual(375);
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);

  const payoutRow = history.locator(".blueprint-data-row--payout");
  await expect(payoutRow).toBeVisible();
  const columns = await payoutRow.evaluate(
    (element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").length,
  );
  expect(columns).toBe(5);
  await expect(payoutRow.locator(".blueprint-payout-account")).toHaveAttribute(
    "title",
    "long-payout-destination-address-for-responsive-layout@mrh-academy.example",
  );
});

test("disabled providers stay hidden and Arabic payout UI remains RTL", async ({
  page,
}) => {
  await mockTutorFinancials(page, [
    { method: "bank_transfer", detailType: "account_details" },
  ]);
  await page.goto("/ar/teach/earnings/payout", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "الأرباح والسحوبات" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "تحويل بنكي" })).toBeVisible();
  await expect(page.getByRole("button", { name: "PayPal" })).toHaveCount(0);
  await expect(page.getByText("Stripe Connect")).toHaveCount(0);
  await expect(page.getByText("إجمالي الأرباح")).toBeVisible();
});
