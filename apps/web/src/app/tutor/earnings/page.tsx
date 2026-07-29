"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";
import {
  ArrowLeftIcon,
  BankIcon,
  BookIcon,
  CheckIcon,
  CloseIcon,
  CreditCardIcon,
  MoneyIcon,
  RefreshIcon,
} from "@/components/icons/Icons";

type TutorProfile = {
  balance: number;
  stripeAccountId?: string;
  stripeOnboardingComplete?: boolean;
};
type Payout = {
  id: string;
  amount: number;
  method: string;
  accountDetails: string;
  status: string;
  adminNote?: string;
  errorMessage?: string;
  createdAt: string;
};
type Transaction = {
  id: string;
  type: "lesson_earning" | "course_earning" | "payout";
  amount: number;
  status: string;
  description: string;
  createdAt: string;
};
const PAYOUT_METHODS = [
  {
    key: "bank_transfer",
    labelAr: "تحويل بنكي",
    labelEn: "Bank Transfer",
    Icon: BankIcon,
  },
  { key: "paypal", labelAr: "PayPal", labelEn: "PayPal", Icon: CreditCardIcon },
  {
    key: "vodafone_cash",
    labelAr: "فودافون كاش",
    labelEn: "Vodafone Cash",
    Icon: MoneyIcon,
  },
  {
    key: "instapay",
    labelAr: "إنستاباي",
    labelEn: "Instapay",
    Icon: CreditCardIcon,
  },
] as const;
type PayoutMethod = (typeof PAYOUT_METHODS)[number]["key"];
const statusConfig: Record<
  string,
  { ar: string; en: string; color: string; bg: string }
> = {
  pending: {
    ar: "قيد الانتظار",
    en: "Pending",
    color: "var(--warning)",
    bg: "var(--warning-soft)",
  },
  processing: {
    ar: "قيد المعالجة",
    en: "Processing",
    color: "var(--info)",
    bg: "var(--info-soft)",
  },
  success: {
    ar: "مكتمل",
    en: "Completed",
    color: "var(--success)",
    bg: "var(--success-soft)",
  },
  completed: {
    ar: "مكتمل",
    en: "Completed",
    color: "var(--success)",
    bg: "var(--success-soft)",
  },
  failed: {
    ar: "فشل",
    en: "Failed",
    color: "var(--danger)",
    bg: "var(--danger-soft)",
  },
  rejected: {
    ar: "مرفوض",
    en: "Rejected",
    color: "var(--danger)",
    bg: "var(--danger-soft)",
  },
};

export default function TutorEarningsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const queryClient = useQueryClient();
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayoutMethod>("bank_transfer");
  const [accountDetails, setAccountDetails] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const routedPanel = pathname.endsWith("/earnings/payout");
  useEffect(() => {
    if (routedPanel) setShowPayoutForm(true);
  }, [routedPanel]);

  const profileQuery = useQuery({
    queryKey: ["tutor-profile-balance"],
    queryFn: async () =>
      (await apiClient.get<TutorProfile>("/tutors/me/profile")).data,
  });
  const transactionsQuery = useQuery({
    queryKey: ["my-earning-transactions"],
    queryFn: async () =>
      (await apiClient.get<Transaction[]>("/payouts/my/transactions")).data,
  });
  const payoutsQuery = useQuery({
    queryKey: ["my-payouts"],
    queryFn: async () => (await apiClient.get<Payout[]>("/payouts/my")).data,
  });
  const requestPayoutMutation = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post("/payouts", {
          amount: Number(amount),
          method,
          accountDetails: accountDetails.trim(),
        })
      ).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-payouts"] }),
        queryClient.invalidateQueries({
          queryKey: ["my-earning-transactions"],
        }),
        queryClient.invalidateQueries({ queryKey: ["tutor-profile-balance"] }),
      ]);
      setSuccessMsg(
        t(
          "تم إرسال طلب السحب وسيتم مراجعته من الإدارة.",
          "Payout request submitted for administrator review.",
        ),
      );
      setAmount("");
      setAccountDetails("");
      setShowPayoutForm(false);
    },
  });

  const balance = Number(profileQuery.data?.balance ?? 0);
  const amountNum = Number(amount);
  const canSubmit =
    Number.isFinite(amountNum) &&
    amountNum >= 10 &&
    amountNum <= balance &&
    accountDetails.trim().length > 3;

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-4 md:p-6">
      <Link
        href="/tutor"
        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium"
        style={{ color: "var(--text-muted)" }}
      >
        <ArrowLeftIcon
          className={`h-4 w-4 ${lang === "ar" ? "rotate-180" : ""}`}
        />
        {t("العودة للوحة التحكم", "Back to Dashboard")}
      </Link>
      <header>
        <p
          className="text-xs font-bold uppercase tracking-[.16em]"
          style={{ color: "var(--signal)" }}
        >
          {t("المالية", "Financials")}
        </p>
        <h1
          className="mt-1 text-2xl font-bold"
          style={{ color: "var(--text-main)" }}
        >
          {t("الأرباح والسحب", "Earnings & Payouts")}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          {t(
            "راجع مصادر أرباحك وطلبات السحب في سجلين واضحين.",
            "Review earning sources and payout requests in two clear records.",
          )}
        </p>
      </header>

      <section
        className="focus-card overflow-hidden"
        aria-labelledby="balance-title"
      >
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p
              id="balance-title"
              className="text-sm font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              {t("الرصيد المتاح", "Available Balance")}
            </p>
            {profileQuery.isLoading ? (
              <div className="mt-2 h-10 w-32 rounded skeleton" />
            ) : profileQuery.isError ? (
              <div className="mt-2">
                <p className="text-sm text-[var(--danger)]">
                  {t("تعذر تحميل الرصيد.", "Balance could not be loaded.")}
                </p>
                <button
                  type="button"
                  onClick={() => profileQuery.refetch()}
                  className="btn-secondary mt-3 min-h-10"
                >
                  <RefreshIcon className="h-4 w-4" />
                  {t("إعادة المحاولة", "Try again")}
                </button>
              </div>
            ) : (
              <p
                className="mt-1 text-4xl font-bold"
                dir="ltr"
                style={{ color: "var(--signal)" }}
              >
                ${balance.toFixed(2)}
              </p>
            )}
          </div>
          {!profileQuery.isError && (
            <button
              type="button"
              onClick={() => {
                if (!showPayoutForm && pathname.includes("/teach/earnings")) {
                  router.push(`/${lang}/teach/earnings/payout`);
                  return;
                }
                setShowPayoutForm((open) => !open);
                requestPayoutMutation.reset();
              }}
              disabled={balance < 10}
              className="btn-primary min-h-11 shrink-0"
            >
              {showPayoutForm
                ? t("إلغاء الطلب", "Cancel request")
                : t("طلب سحب", "Request Payout")}
            </button>
          )}
        </div>
        {!profileQuery.isLoading && !profileQuery.isError && balance < 10 && (
          <p
            className="border-t px-5 py-3 text-xs sm:px-6"
            style={{
              borderColor: "var(--border-color)",
              color: "var(--text-muted)",
            }}
          >
            {balance > 0
              ? t(
                  "الحد الأدنى للسحب هو $10.",
                  "The minimum payout amount is $10.",
                )
              : t(
                  "أكمل درساً أو حقق عملية بيع لبدء تكوين رصيد.",
                  "Complete a lesson or make a course sale to begin earning.",
                )}
          </p>
        )}
      </section>

      <div aria-live="polite">
        {successMsg && (
          <div
            className="flex items-start gap-3 rounded-xl border p-4"
            style={{
              borderColor:
                "color-mix(in srgb, var(--success) 30%, transparent)",
              background: "var(--success-soft)",
              color: "var(--success)",
            }}
          >
            <CheckIcon className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="flex-1 text-sm font-semibold">{successMsg}</p>
            <button
              type="button"
              onClick={() => setSuccessMsg("")}
              className="min-h-10 min-w-10 p-2"
              aria-label={t("إغلاق الرسالة", "Dismiss message")}
              title={t("إغلاق", "Close")}
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {showPayoutForm && (
        <section
          className={`card p-5 sm:p-6 ${routedPanel ? "routed-payout-form" : ""}`}
          aria-labelledby="payout-form-title"
        >
          {routedPanel && (
            <div className="routed-payment-header">
              <div>
                <strong>{t("طلب سحب", "Request Payout")}</strong>
                <span>
                  {t(
                    "طلب مالي يخضع لتأكيد الخادم",
                    "Server-authoritative financial request",
                  )}
                </span>
              </div>
              <Link
                href={`/${lang}/teach/earnings`}
                aria-label={t("إغلاق", "Close")}
              >
                ×
              </Link>
            </div>
          )}
          <h2
            id="payout-form-title"
            className="text-lg font-bold"
            style={{ color: "var(--text-main)" }}
          >
            {t("طلب سحب أرباح", "Request Payout")}
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {t(
              "اختر وسيلة الاستلام وأدخل بيانات الحساب بدقة.",
              "Choose a receiving method and enter the account details carefully.",
            )}
          </p>
          <form
            className="mt-5 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSubmit && !requestPayoutMutation.isPending) {
                requestPayoutMutation.mutate();
              }
            }}
          >
            <label
              className="block text-sm font-semibold"
              style={{ color: "var(--text-main)" }}
            >
              {t("المبلغ (USD)", "Amount (USD)")}
              <input
                type="number"
                min="10"
                max={balance}
                step=".01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="input-field mt-1.5"
                placeholder="0.00"
                dir="ltr"
              />
              <span
                className="mt-1.5 block text-xs font-normal"
                style={{ color: "var(--text-muted)" }}
              >
                {t(
                  `متاح: $${balance.toFixed(2)} · الحد الأدنى: $10`,
                  `Available: $${balance.toFixed(2)} · Minimum: $10`,
                )}
              </span>
            </label>
            <fieldset>
              <legend
                className="text-sm font-semibold"
                style={{ color: "var(--text-main)" }}
              >
                {t("طريقة السحب", "Payout Method")}
              </legend>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PAYOUT_METHODS.map(({ key, labelAr, labelEn, Icon }) => (
                  <label
                    key={key}
                    className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors"
                    style={{
                      borderColor:
                        method === key
                          ? "var(--signal)"
                          : "var(--border-color)",
                      background:
                        method === key
                          ? "color-mix(in srgb, var(--signal) 10%, transparent)"
                          : "var(--bg-light)",
                    }}
                  >
                    <input
                      type="radio"
                      name="payout-method"
                      value={key}
                      checked={method === key}
                      onChange={() => setMethod(key)}
                      className="sr-only"
                    />
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-md"
                      style={{
                        color:
                          method === key
                            ? "var(--signal)"
                            : "var(--text-muted)",
                        background: "var(--bg-main)",
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: "var(--text-main)" }}
                    >
                      {lang === "ar" ? labelAr : labelEn}
                    </span>
                    {method === key && (
                      <CheckIcon className="ms-auto h-4 w-4 text-[var(--signal)]" />
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
            <label
              className="block text-sm font-semibold"
              style={{ color: "var(--text-main)" }}
            >
              {t("تفاصيل الحساب", "Account Details")}
              <input
                value={accountDetails}
                onChange={(event) => setAccountDetails(event.target.value)}
                className="input-field mt-1.5"
                placeholder={
                  method === "bank_transfer"
                    ? t("رقم الحساب / IBAN", "Account number / IBAN")
                    : method === "paypal"
                      ? "PayPal email"
                      : t("رقم الهاتف أو معرف الحساب", "Phone or account ID")
                }
              />
            </label>
            {requestPayoutMutation.isError && (
              <p
                role="alert"
                className="rounded-lg border px-4 py-3 text-sm text-[var(--danger)]"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--danger) 35%, transparent)",
                  background: "var(--danger-soft)",
                }}
              >
                {(
                  requestPayoutMutation.error as {
                    response?: { data?: { message?: string } };
                  }
                )?.response?.data?.message ??
                  t(
                    "تعذر إرسال طلب السحب. راجع البيانات وحاول مجدداً.",
                    "The payout request could not be submitted. Review the details and try again.",
                  )}
              </p>
            )}
            <button
              type="submit"
              disabled={!canSubmit || requestPayoutMutation.isPending}
              className="btn-primary min-h-12 w-full"
            >
              {requestPayoutMutation.isPending
                ? t("جاري الإرسال...", "Submitting...")
                : t("إرسال طلب السحب", "Submit Payout Request")}
            </button>
          </form>
        </section>
      )}

      <HistorySection
        title={t("سجل المعاملات", "Transaction History")}
        subtitle={t(
          "أرباح الدروس والدورات وطلبات السحب بترتيب زمني.",
          "Lesson earnings, course earnings, and payouts in chronological order.",
        )}
        loading={transactionsQuery.isLoading}
        error={transactionsQuery.isError}
        retry={() => transactionsQuery.refetch()}
        empty={transactionsQuery.data?.length === 0}
        emptyText={t("لا توجد معاملات بعد.", "No transactions yet.")}
        retryText={t("إعادة المحاولة", "Try again")}
        errorText={t(
          "تعذر تحميل سجل المعاملات.",
          "Transaction history could not be loaded.",
        )}
      >
        <div
          className="divide-y"
          style={{ borderColor: "var(--border-color)" }}
        >
          {transactionsQuery.data?.map((transaction) => {
            const earning = transaction.type !== "payout";
            const Icon =
              transaction.type === "lesson_earning"
                ? BookIcon
                : transaction.type === "course_earning"
                  ? CreditCardIcon
                  : MoneyIcon;
            const cfg =
              statusConfig[transaction.status] ?? statusConfig.pending;
            return (
              <article
                key={`${transaction.type}-${transaction.id}`}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: earning
                      ? "var(--success-soft)"
                      : "color-mix(in srgb, var(--signal) 12%, transparent)",
                    color: earning ? "var(--success)" : "var(--signal)",
                  }}
                >
                  <Icon />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-main)" }}
                  >
                    {transaction.description}
                  </p>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {transaction.type === "lesson_earning"
                      ? t("ربح درس", "Lesson earning")
                      : transaction.type === "course_earning"
                        ? t("ربح دورة", "Course earning")
                        : t("طلب سحب", "Payout")}{" "}
                    · {new Date(transaction.createdAt).toLocaleString(locale)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:block sm:text-end">
                  <p
                    className="font-bold"
                    dir="ltr"
                    style={{
                      color: earning ? "var(--success)" : "var(--danger)",
                    }}
                  >
                    {transaction.amount >= 0 ? "+" : "−"}$
                    {Math.abs(transaction.amount).toFixed(2)}
                  </p>
                  <span
                    className="mt-1 inline-block rounded-md px-2 py-1 text-xs font-semibold"
                    style={{ color: cfg.color, background: cfg.bg }}
                  >
                    {lang === "ar" ? cfg.ar : cfg.en}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </HistorySection>

      <HistorySection
        title={t("سجل السحوبات", "Payout History")}
        subtitle={t(
          "حالة كل طلب سحب قدمته.",
          "The status of each payout request you submitted.",
        )}
        loading={payoutsQuery.isLoading}
        error={payoutsQuery.isError}
        retry={() => payoutsQuery.refetch()}
        empty={payoutsQuery.data?.length === 0}
        emptyText={t("لا توجد طلبات سحب بعد.", "No payout requests yet.")}
        retryText={t("إعادة المحاولة", "Try again")}
        errorText={t(
          "تعذر تحميل سجل السحوبات.",
          "Payout history could not be loaded.",
        )}
      >
        <div
          className="divide-y"
          style={{ borderColor: "var(--border-color)" }}
        >
          {payoutsQuery.data?.map((payout) => {
            const cfg = statusConfig[payout.status] ?? statusConfig.pending;
            return (
              <article key={payout.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      color: "var(--signal)",
                      background:
                        "color-mix(in srgb, var(--signal) 12%, transparent)",
                    }}
                  >
                    <MoneyIcon />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="font-bold"
                      dir="ltr"
                      style={{ color: "var(--text-main)" }}
                    >
                      ${Number(payout.amount).toFixed(2)}
                    </p>
                    <p
                      className="mt-1 break-words text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {payout.method} · {payout.accountDetails} ·{" "}
                      {new Date(payout.createdAt).toLocaleString(locale)}
                    </p>
                  </div>
                  <span
                    className="self-start rounded-md px-2.5 py-1 text-xs font-semibold sm:self-auto"
                    style={{ color: cfg.color, background: cfg.bg }}
                  >
                    {lang === "ar" ? cfg.ar : cfg.en}
                  </span>
                </div>
                {(payout.errorMessage || payout.adminNote) && (
                  <p
                    className="mt-2 text-xs"
                    style={{
                      color: payout.errorMessage
                        ? "var(--danger)"
                        : "var(--text-muted)",
                    }}
                  >
                    {payout.errorMessage || payout.adminNote}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </HistorySection>
    </main>
  );
}

function HistorySection({
  title,
  subtitle,
  loading,
  error,
  retry,
  empty,
  emptyText,
  errorText,
  retryText,
  children,
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  error: boolean;
  retry: () => unknown;
  empty: boolean;
  emptyText: string;
  errorText: string;
  retryText: string;
  children: ReactNode;
}) {
  return (
    <section className="card p-5 sm:p-6">
      <header className="mb-5">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
          {title}
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          {subtitle}
        </p>
      </header>
      {loading ? (
        <div className="space-y-3" aria-label={title}>
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-16 rounded skeleton" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="py-5 text-center">
          <p className="text-sm font-semibold text-[var(--danger)]">
            {errorText}
          </p>
          <button
            type="button"
            onClick={retry}
            className="btn-secondary mt-3 min-h-10"
          >
            <RefreshIcon className="h-4 w-4" />
            {retryText}
          </button>
        </div>
      ) : empty ? (
        <div
          className="rounded-xl border border-dashed px-5 py-9 text-center"
          style={{ borderColor: "var(--border-color)" }}
        >
          <MoneyIcon className="mx-auto h-7 w-7 text-[var(--signal)]" />
          <p
            className="mt-3 text-sm font-semibold"
            style={{ color: "var(--text-muted)" }}
          >
            {emptyText}
          </p>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
