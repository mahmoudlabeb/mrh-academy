import { expect, test, type Page, type Route } from "@playwright/test";

const entries = [
  {
    id: "ledger-paid-1",
    eventKey: "payment:payment-paid-1",
    transactionType: "wallet_top_up",
    status: "succeeded",
    provider: "stripe",
    method: "card",
    amount: 125,
    currency: "USD",
    user: {
      id: "student-1",
      name: "Mariam Hassan",
      email: "mariam@mrh-academy.example",
    },
    tutor: null,
    providerReferenceId: "pi_verified_ledger_001",
    providerStatus: "PAID",
    paymentId: "payment-paid-1",
    course: null,
    enrollmentId: null,
    lesson: null,
    payoutId: null,
    adminCommission: 0,
    tutorShare: 0,
    balanceBefore: 25,
    balanceAfter: 150,
    occurredAt: "2030-01-07T10:30:00.000Z",
    createdAt: "2030-01-07T10:30:00.000Z",
    updatedAt: "2030-01-07T10:30:00.000Z",
  },
  {
    id: "ledger-failed-1",
    eventKey: "payment:payment-failed-1",
    transactionType: "wallet_top_up",
    status: "failed",
    provider: "stripe",
    method: "card",
    amount: 50,
    currency: "USD",
    user: {
      id: "student-2",
      name: "Ahmed Salem",
      email: "ahmed@mrh-academy.example",
    },
    tutor: null,
    providerReferenceId: "pi_card_declined_002",
    providerStatus: "card_declined",
    paymentId: "payment-failed-1",
    course: null,
    enrollmentId: null,
    lesson: null,
    payoutId: null,
    adminCommission: 0,
    tutorShare: 0,
    balanceBefore: 10,
    balanceAfter: 10,
    occurredAt: "2030-01-07T09:00:00.000Z",
    createdAt: "2030-01-07T09:00:00.000Z",
    updatedAt: "2030-01-07T09:00:00.000Z",
  },
];

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installMocks(page: Page) {
  await page.context().addCookies([
    {
      name: "mrh_token",
      value: "admin-payment-ledger-token",
      url: "http://127.0.0.1:3210",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/users/me") {
      return json(route, {
        id: "admin-1",
        email: "admin@mrh-academy.example",
        firstName: "Operations",
        lastName: "Admin",
        avatarUrl: null,
        role: "admin",
        assignedPermissions: ["manage_payments"],
      });
    }
    if (url.pathname.startsWith("/api/v1/admin/payments/")) {
      const id = url.pathname.split("/").at(-1);
      const entry = entries.find((candidate) => candidate.id === id);
      return entry
        ? json(route, {
            ...entry,
            audit: {
              source: "stripe_webhook",
              providerEventId: "evt_verified_001",
            },
          })
        : json(route, { message: "Not found" }, 404);
    }
    if (url.pathname === "/api/v1/admin/payments") {
      const status = url.searchParams.get("status") ?? "all";
      const items =
        status === "all"
          ? entries
          : entries.filter((entry) => entry.status === status);
      return json(route, {
        items,
        total: items.length,
        page: 1,
        limit: 50,
      });
    }
    return json(route, []);
  });
}

test("admin payment ledger filters verified records and opens safe audit details", async ({
  page,
}) => {
  await installMocks(page);
  await page.goto("/ar/ops/money/payments");

  await expect(
    page.getByRole("heading", { name: "سجل المدفوعات" }),
  ).toBeVisible();
  await expect(page.getByText("Mariam Hassan")).toBeVisible();
  await expect(page.getByText("Ahmed Salem")).toBeVisible();
  await expect(page.locator('[title="pi_verified_ledger_001"]')).toBeVisible();

  await page.getByRole("button", { name: "فشلت" }).click();
  await expect(page.getByText("Ahmed Salem")).toBeVisible();
  await expect(page.getByText("Mariam Hassan")).toHaveCount(0);

  await page.getByRole("button", { name: "الكل" }).click();
  await page.getByRole("button", { name: "عرض السجل" }).first().click();
  const dialog = page.getByRole("dialog", { name: "سجل الحركة المالية" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("pi_verified_ledger_001")).toBeVisible();
  await expect(dialog.getByText("evt_verified_001")).toBeVisible();
  await expect(dialog.getByText("الرصيد بعد")).toBeVisible();

  await expect(
    page.getByRole("button", { name: /اعتماد|approve/i }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /رفض|reject/i })).toHaveCount(
    0,
  );
});
