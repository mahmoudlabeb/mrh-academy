import { expect, Page, test } from "@playwright/test";

const api = "**/api/v1";

async function mockStudentWallet(page: Page) {
  await page.context().addCookies([
    {
      name: "mrh_token",
      value: "sandbox-payment-smoke-token",
      url: "http://127.0.0.1:3100",
      httpOnly: true,
      sameSite: "Strict",
    },
    {
      name: "mrh_csrf",
      value: "sandbox-payment-smoke-csrf",
      url: "http://127.0.0.1:3100",
      httpOnly: false,
      sameSite: "Strict",
    },
  ]);
  await page.route(`${api}/users/me`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "sandbox-student-1",
        email: "payment-smoke@mrh-academy.example",
        firstName: "Sandbox",
        lastName: "Student",
        role: "student",
        isVerified: true,
        isActive: true,
      }),
    }),
  );
  await page.route(`${api}/students/balance`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ balance: 25, creditPrice: 15, egpRate: 50 }),
    }),
  );
  await page.route(`${api}/payment-methods`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { type: "card", label: "Card", enabled: true, details: null },
        {
          type: "paypal",
          label: "PayPal",
          enabled: true,
          details: null,
        },
      ]),
    }),
  );
  await page.route(`${api}/payments/history**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    }),
  );
  await page.route(`${api}/notifications**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    }),
  );
}

test("sandbox payment: EGP card checkout preserves provider currency", async ({
  page,
}) => {
  await mockStudentWallet(page);
  let submittedBody: Record<string, unknown> = {};
  await page.route(`${api}/payments/submit`, async (route) => {
    submittedBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        payment: { id: "payment-sandbox-1", status: "pending" },
        checkoutUrl: "https://checkout.stripe.test/sandbox-session",
      }),
    });
  });
  await page.route("https://checkout.stripe.test/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<h1>Stripe sandbox checkout</h1>",
    }),
  );

  await page.goto("/en/learn/wallet/add");
  await page.getByLabel("Custom amount").fill("1500");
  await page.getByLabel("Currency").selectOption("EGP");
  await expect(
    page.getByText("After verification").locator(".."),
  ).toContainText("$55.00");
  await page
    .getByRole("button", { name: /Confirm deposit of EGP\s*1,500\.00/ })
    .click();

  await expect(page).toHaveURL("https://checkout.stripe.test/sandbox-session");
  expect(submittedBody).toEqual(
    expect.objectContaining({
      amount: 1500,
      currency: "EGP",
      method: "card",
      returnLocale: "en",
      idempotencyKey: expect.any(String),
    }),
  );
});

test("sandbox payment: student funding exposes no manual approval workflow", async ({
  page,
}) => {
  await mockStudentWallet(page);

  await page.goto("/en/learn/wallet/add");

  await expect(page.getByRole("button", { name: "Bank transfer" })).toHaveCount(
    0,
  );
  await expect(page.getByLabel("Transfer receipt")).toHaveCount(0);
  await expect(page.getByText(/administrator review/i)).toHaveCount(0);
  await expect(page.getByText(/waiting for approval/i)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Card via Stripe" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "PayPal" })).toBeVisible();
});
