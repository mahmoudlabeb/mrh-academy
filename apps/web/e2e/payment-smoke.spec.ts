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
          type: "bank",
          label: "Sandbox bank",
          enabled: true,
          details: "Fictional transfer destination",
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
  let submittedBody = "";
  await page.route(`${api}/payments/submit`, async (route) => {
    submittedBody = route.request().postData() ?? "";
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
  await expect(page.getByText("After verification").locator("..")).toContainText(
    "$55.00",
  );
  await page
    .getByRole("button", { name: /Confirm deposit of EGP\s*1,500\.00/ })
    .click();

  await expect(page).toHaveURL(
    "https://checkout.stripe.test/sandbox-session",
  );
  expect(submittedBody).toContain('name="amount"');
  expect(submittedBody).toContain("1500");
  expect(submittedBody).toContain('name="currency"');
  expect(submittedBody).toContain("EGP");
});

test("sandbox payment: manual receipt remains pending until admin review", async ({
  page,
}) => {
  await mockStudentWallet(page);
  let submittedBody = "";
  await page.route(`${api}/payments/submit`, async (route) => {
    submittedBody = route.request().postData() ?? "";
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        payment: {
          id: "payment-manual-1",
          amount: 50,
          currency: "USD",
          method: "bank",
          status: "pending",
        },
      }),
    });
  });

  await page.goto("/en/learn/wallet/add");
  await page.getByRole("button", { name: "Bank transfer" }).click();
  await page.getByLabel("Custom amount").fill("50");
  await page
    .getByLabel("Transfer receipt")
    .setInputFiles({
      name: "sandbox-receipt.png",
      mimeType: "image/png",
      buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]),
    });
  await page
    .getByRole("button", { name: "Confirm deposit of $50.00" })
    .click();

  await expect(
    page.getByText("Payment request received by the server"),
  ).toBeVisible();
  await expect(
    page.getByText("Your balance will update after administrator review."),
  ).toBeVisible();
  expect(submittedBody).toContain('name="method"');
  expect(submittedBody).toContain("bank");
  expect(submittedBody).toContain('name="screenshot"');
  expect(submittedBody).toContain("sandbox-receipt.png");
});
