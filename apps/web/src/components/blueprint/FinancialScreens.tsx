"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { PaymentMethod } from "@mrh/types";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";
import { RoutedPanel } from "@/components/shared/RoutedPanel";
import { formatCurrency } from "@/lib/format";

type Balance = { balance: number; creditPrice: number; egpRate: number };
type Payment = {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  createdAt: string;
};
type PaymentMethodConfig = {
  type: string;
  label: string;
  enabled: boolean;
  details: string | null;
};
type TutorProfile = {
  balance: number;
  stripeAccountId?: string;
  stripeOnboardingComplete?: boolean;
};
type Transaction = {
  id: string;
  type: "lesson_earning" | "course_earning" | "payout";
  amount: number;
  status: string;
  description: string;
  createdAt: string;
};
type Payout = {
  id: string;
  amount: number;
  method: string;
  accountDetails: string;
  status: string;
  createdAt: string;
};

function useCopy() {
  const { lang } = useLanguage();
  return {
    lang,
    t: (ar: string, en: string) => (lang === "ar" ? ar : en),
    formatDate: (value: string) =>
      new Date(value).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US"),
  };
}

function DataNotice({
  loading,
  error,
  empty,
  children,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  const { t } = useCopy();
  if (loading) return <div className="skeleton h-20 rounded" />;
  if (error)
    return (
      <p className="blueprint-error">
        {t("تعذر تحميل السجل.", "The record could not be loaded.")}
      </p>
    );
  if (empty)
    return (
      <p className="blueprint-empty-row">
        {t("لا توجد معاملات بعد.", "No transactions yet.")}
      </p>
    );
  return children;
}

export function WalletScreen({ addFunds = false }: { addFunds?: boolean }) {
  const { lang, t, formatDate } = useCopy();
  const balanceQuery = useQuery({
    queryKey: ["blueprint-wallet-balance"],
    queryFn: async () =>
      (await apiClient.get<Balance>("/students/balance")).data,
  });
  const paymentsQuery = useQuery({
    queryKey: ["blueprint-payment-history"],
    queryFn: async () =>
      (await apiClient.get<Payment[]>("/payments/history")).data,
  });
  const balance = Number(balanceQuery.data?.balance ?? 0);
  return (
    <main className="blueprint-workspace-page">
      <header className="blueprint-workspace-head">
        <div>
          <p className="blueprint-kicker">
            {t("المالية الشخصية", "Personal financials")}
          </p>
          <h1>{t("محفظة MRH والمدفوعات", "MRH Wallet & Payments")}</h1>
          <p>
            {t(
              "أدر الأموال وطرق الدفع والإيصالات.",
              "Manage funds, payment methods, and transaction receipts.",
            )}
          </p>
        </div>
        <Link className="btn-primary" href={`/${lang}/learn/wallet/add`}>
          ＋ {t("إضافة رصيد", "Add funds")}
        </Link>
      </header>
      <section className="blueprint-balance-card">
        <small>{t("الرصيد المتاح", "Available wallet balance")}</small>
        {balanceQuery.isLoading ? (
          <div className="skeleton h-12 w-40 rounded" />
        ) : balanceQuery.isError ? (
          <p className="blueprint-error">
            {t("تعذر التحقق من الرصيد.", "Balance verification failed.")}
          </p>
        ) : (
          <strong>{formatCurrency(lang, balance)}</strong>
        )}
        <p>
          ✓{" "}
          {t(
            "الرصيد معتمد من الخادم ويتغير بعد تأكيد العملية.",
            "Server-authoritative balance updates only after transaction confirmation.",
          )}
        </p>
      </section>
      <section className="blueprint-table-section">
        <h2>{t("سجل المدفوعات والإيصالات", "Payment History & Receipts")}</h2>
        <DataNotice
          loading={paymentsQuery.isLoading}
          error={paymentsQuery.isError}
          empty={!paymentsQuery.data?.length}
        >
          <div className="blueprint-data-table" role="table">
            <div
              className="blueprint-data-row blueprint-data-row--head"
              role="row"
            >
              <span>{t("المعاملة", "Transaction")}</span>
              <span>{t("الطريقة", "Method")}</span>
              <span>{t("التاريخ", "Date")}</span>
              <span>{t("المبلغ", "Amount")}</span>
              <span>{t("الحالة", "Status")}</span>
            </div>
            {paymentsQuery.data?.map((payment) => (
              <div className="blueprint-data-row" role="row" key={payment.id}>
                <strong>{payment.id}</strong>
                <span>{payment.method}</span>
                <span>{formatDate(payment.createdAt)}</span>
                <strong>
                  {payment.amount >= 0 ? "+" : "−"}
                  {formatCurrency(lang, Math.abs(Number(payment.amount)))}
                </strong>
                <span
                  className={`blueprint-status blueprint-status--${payment.status}`}
                >
                  {payment.status}
                </span>
              </div>
            ))}
          </div>
        </DataNotice>
      </section>
      {addFunds && <AddFundsPanel balance={balance} />}
    </main>
  );
}

const PAYMENT_OPTIONS = [
  { key: PaymentMethod.CARD, ar: "بطاقة", en: "Card", receipt: false },
  { key: PaymentMethod.PAYPAL, ar: "PayPal", en: "PayPal", receipt: false },
  {
    key: PaymentMethod.VODAFONE,
    ar: "فودافون كاش",
    en: "Vodafone Cash",
    receipt: true,
  },
  {
    key: PaymentMethod.INSTAPAY,
    ar: "إنستاباي",
    en: "Instapay",
    receipt: true,
  },
  {
    key: PaymentMethod.BANK,
    ar: "تحويل بنكي",
    en: "Bank transfer",
    receipt: true,
  },
] as const;

function AddFundsPanel({ balance }: { balance: number }) {
  const { lang, t } = useCopy();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("50");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [currency, setCurrency] = useState<"USD" | "EGP">("USD");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const methodsQuery = useQuery({
    queryKey: ["blueprint-payment-methods"],
    queryFn: async () =>
      (await apiClient.get<PaymentMethodConfig[]>("/payment-methods")).data,
  });
  const visible = PAYMENT_OPTIONS.filter((option) =>
    methodsQuery.data?.some(
      (config) => config.enabled && config.type === option.key,
    ),
  );
  useEffect(() => {
    if (!methodsQuery.isSuccess) return;
    const firstEnabled = PAYMENT_OPTIONS.find((option) =>
      methodsQuery.data.some(
        (config) => config.enabled && config.type === option.key,
      ),
    );
    setMethod((current) =>
      firstEnabled &&
      PAYMENT_OPTIONS.some(
        (option) =>
          option.key === current &&
          methodsQuery.data.some(
            (config) => config.enabled && config.type === option.key,
          ),
      )
        ? current
        : (firstEnabled?.key ?? null),
    );
  }, [methodsQuery.data, methodsQuery.isSuccess]);
  const selected = PAYMENT_OPTIONS.find((option) => option.key === method);
  const amountNumber = Number(amount);
  const submit = useMutation({
    mutationFn: async () => {
      const data = new FormData();
      data.append("amount", String(amountNumber));
      if (!method) throw new Error("No enabled payment method selected");
      data.append("method", method);
      data.append("currency", currency);
      data.append("idempotencyKey", crypto.randomUUID());
      if (note.trim()) data.append("adminNote", note.trim());
      if (receipt) data.append("screenshot", receipt);
      return (
        await apiClient.post<{ checkoutUrl?: string }>(
          "/payments/submit",
          data,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        )
      ).data;
    },
    onSuccess: async (data) => {
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["blueprint-wallet-balance"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["blueprint-payment-history"],
        }),
      ]);
      setSubmitted(true);
    },
  });
  const selectedMethodIsEnabled =
    method !== null && visible.some((option) => option.key === method);
  const canSubmit =
    methodsQuery.isSuccess &&
    selectedMethodIsEnabled &&
    amountNumber >= 5 &&
    (!selected?.receipt || Boolean(receipt));
  return (
    <RoutedPanel
      title={t("إضافة رصيد إلى محفظة MRH", "Add funds to MRH Wallet")}
      subtitle={t(
        "إيداع يتحقق منه الخادم",
        "Server-authoritative wallet deposit",
      )}
      onClose={() => router.push(`/${lang}/learn/wallet`)}
      footer={
        !submitted ? (
          <button
            className="btn-primary blueprint-panel-submit"
            disabled={!canSubmit || submit.isPending}
            type="button"
            onClick={() => submit.mutate()}
          >
            {submit.isPending
              ? t("جارٍ إرسال العملية…", "Submitting transaction…")
              : t(
                  `تأكيد إيداع ${formatCurrency(lang, amountNumber)}`,
                  `Confirm deposit of ${formatCurrency(lang, amountNumber)}`,
                )}
          </button>
        ) : undefined
      }
    >
      {submitted ? (
        <div
          className="blueprint-result blueprint-result--success"
          role="status"
          aria-live="polite"
        >
          <span>✓</span>
          <h3>
            {t(
              "استلم الخادم طلب الدفع",
              "Payment request received by the server",
            )}
          </h3>
          <p>
            {selected?.receipt
              ? t(
                  "سيظهر الرصيد بعد مراجعة الإدارة.",
                  "Your balance will update after administrator review.",
                )
              : t(
                  "سيظهر الرصيد بعد تحقق مزود الدفع والخادم.",
                  "Your balance will update after provider and server verification.",
                )}
          </p>
          <button
            className="btn-primary"
            type="button"
            onClick={() => router.push(`/${lang}/learn/wallet`)}
          >
            {t("العودة للمحفظة", "Return to wallet")}
          </button>
        </div>
      ) : (
        <div className="blueprint-panel-form">
          <fieldset>
            <legend>{t("اختر المبلغ", "Select amount")}</legend>
            <div className="blueprint-choice-row blueprint-choice-row--wide">
              {[20, 50, 100].map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={amount === String(value)}
                  onClick={() => setAmount(String(value))}
                >
                  {formatCurrency(lang, value, 0)}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            {t("مبلغ مخصص", "Custom amount")}
            <input
              type="number"
              min="5"
              step=".01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label>
            {t("العملة", "Currency")}
            <select
              value={currency}
              onChange={(event) =>
                setCurrency(event.target.value as "USD" | "EGP")
              }
            >
              <option>USD</option>
              <option>EGP</option>
            </select>
          </label>
          <fieldset>
            <legend>{t("طريقة الدفع", "Payment method")}</legend>
            {methodsQuery.isLoading ? (
              <div className="blueprint-method-state" role="status">
                <div className="skeleton h-12 rounded" />
                <p>
                  {t(
                    "جارٍ التحقق من طرق الدفع المفعلة…",
                    "Checking enabled payment methods…",
                  )}
                </p>
              </div>
            ) : methodsQuery.isError ? (
              <div
                className="blueprint-method-state blueprint-method-state--error"
                role="alert"
              >
                <p>
                  {t(
                    "تعذر التحقق من إعدادات الدفع. لا يمكن إرسال أي دفعة بأمان.",
                    "Payment configuration could not be verified. No payment can be submitted safely.",
                  )}
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => methodsQuery.refetch()}
                >
                  {t("إعادة المحاولة", "Try again")}
                </button>
              </div>
            ) : visible.length ? (
              <div className="blueprint-choice-row">
                {visible.map((option) => (
                  <button
                    type="button"
                    key={option.key}
                    aria-pressed={method === option.key}
                    onClick={() => {
                      setMethod(option.key);
                      setReceipt(null);
                    }}
                  >
                    {lang === "ar" ? option.ar : option.en}
                  </button>
                ))}
              </div>
            ) : (
              <p className="blueprint-error">
                {t(
                  "لا توجد طريقة دفع مفعلة حالياً. لم يتم إرسال أي طلب.",
                  "No payment method is currently enabled. No request can be submitted.",
                )}
              </p>
            )}
          </fieldset>
          {selected?.receipt && (
            <>
              <label>
                {t("إثبات التحويل", "Transfer receipt")}
                <input
                  type="file"
                  accept="image/png,image/jpeg,application/pdf"
                  onChange={(event) =>
                    setReceipt(event.target.files?.[0] ?? null)
                  }
                />
              </label>
              <label>
                {t("ملاحظة اختيارية", "Optional note")}
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
            </>
          )}
          <div className="blueprint-money-preview">
            <p>
              <span>{t("الرصيد الحالي", "Current balance")}</span>
              <strong>{formatCurrency(lang, balance)}</strong>
            </p>
            <p>
              <span>{t("بعد التحقق", "After verification")}</span>
              <strong>
                {formatCurrency(lang, balance + Math.max(0, amountNumber))}
              </strong>
            </p>
            <small>
              {t(
                "هذا تقدير فقط؛ يعرض الرصيد الفعلي بعد استجابة الخادم.",
                "This is a preview; actual balance appears only after server confirmation.",
              )}
            </small>
          </div>
          {submit.isError && (
            <p className="blueprint-error" role="alert">
              {(submit.error as { response?: { data?: { message?: string } } })
                ?.response?.data?.message ??
                t("تعذر إرسال الدفع.", "Payment submission failed.")}
            </p>
          )}
        </div>
      )}
    </RoutedPanel>
  );
}

export function EarningsScreen({ payout = false }: { payout?: boolean }) {
  const { lang, t, formatDate } = useCopy();
  const profileQuery = useQuery({
    queryKey: ["blueprint-tutor-financial-profile"],
    queryFn: async () =>
      (await apiClient.get<TutorProfile>("/tutors/me/profile")).data,
  });
  const transactionsQuery = useQuery({
    queryKey: ["blueprint-tutor-transactions"],
    queryFn: async () =>
      (await apiClient.get<Transaction[]>("/payouts/my/transactions")).data,
  });
  const payoutsQuery = useQuery({
    queryKey: ["blueprint-tutor-payouts"],
    queryFn: async () => (await apiClient.get<Payout[]>("/payouts/my")).data,
  });
  const balance = Number(profileQuery.data?.balance ?? 0);
  return (
    <main className="blueprint-workspace-page">
      <header className="blueprint-workspace-head">
        <div>
          <p className="blueprint-kicker">
            {t("مالية المعلم", "Tutor financials")}
          </p>
          <h1>{t("الأرباح والسحوبات", "Earnings & Payouts")}</h1>
          <p>
            {t(
              "تتبع الإيرادات والعمولات والتحويلات.",
              "Track teaching revenue, commission tiers, and transfers.",
            )}
          </p>
        </div>
        <Link className="btn-primary" href={`/${lang}/teach/earnings/payout`}>
          ＄ {t("طلب سحب", "Request payout")}
        </Link>
      </header>
      <div className="blueprint-stat-grid">
        <section>
          <small>{t("متاح للسحب", "Available for payout")}</small>
          <strong>{formatCurrency(lang, balance)}</strong>
        </section>
        <section>
          <small>{t("حساب Stripe", "Stripe Connect")}</small>
          <strong
            className={
              profileQuery.data?.stripeOnboardingComplete ? "success" : ""
            }
          >
            {profileQuery.data?.stripeOnboardingComplete
              ? t("نشط", "Active")
              : t("غير مكتمل", "Not connected")}
          </strong>
        </section>
        <section>
          <small>{t("طلبات السحب", "Payout requests")}</small>
          <strong>{payoutsQuery.data?.length ?? "—"}</strong>
        </section>
      </div>
      <section className="blueprint-table-section">
        <h2>{t("سجل الأرباح", "Earnings history")}</h2>
        <DataNotice
          loading={transactionsQuery.isLoading}
          error={transactionsQuery.isError}
          empty={!transactionsQuery.data?.length}
        >
          <div className="blueprint-data-table">
            {transactionsQuery.data?.map((transaction) => (
              <div
                className="blueprint-data-row blueprint-data-row--compact"
                key={`${transaction.type}-${transaction.id}`}
              >
                <strong>{transaction.description}</strong>
                <span>{formatDate(transaction.createdAt)}</span>
                <strong>
                  {transaction.amount >= 0 ? "+" : "−"}
                  {formatCurrency(lang, Math.abs(Number(transaction.amount)))}
                </strong>
                <span
                  className={`blueprint-status blueprint-status--${transaction.status}`}
                >
                  {transaction.status}
                </span>
              </div>
            ))}
          </div>
        </DataNotice>
      </section>
      <section className="blueprint-table-section">
        <h2>{t("سجل السحب", "Payout transfer history")}</h2>
        <DataNotice
          loading={payoutsQuery.isLoading}
          error={payoutsQuery.isError}
          empty={!payoutsQuery.data?.length}
        >
          <div className="blueprint-data-table">
            {payoutsQuery.data?.map((item) => (
              <div
                className="blueprint-data-row blueprint-data-row--compact"
                key={item.id}
              >
                <strong>{item.method}</strong>
                <span>{item.accountDetails}</span>
                <span>{formatDate(item.createdAt)}</span>
                <strong>{formatCurrency(lang, Number(item.amount))}</strong>
                <span
                  className={`blueprint-status blueprint-status--${item.status}`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </DataNotice>
      </section>
      {payout && (
        <PayoutPanel
          balance={balance}
          stripeReady={Boolean(profileQuery.data?.stripeOnboardingComplete)}
        />
      )}
    </main>
  );
}

const PAYOUT_METHODS = [
  { key: "bank_transfer", ar: "تحويل بنكي", en: "Bank transfer" },
  { key: "paypal", ar: "PayPal", en: "PayPal" },
  { key: "vodafone_cash", ar: "فودافون كاش", en: "Vodafone Cash" },
  { key: "instapay", ar: "إنستاباي", en: "Instapay" },
] as const;

function PayoutPanel({
  balance,
  stripeReady,
}: {
  balance: number;
  stripeReady: boolean;
}) {
  const { lang, t } = useCopy();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(balance ? String(balance) : "");
  const [method, setMethod] =
    useState<(typeof PAYOUT_METHODS)[number]["key"]>("bank_transfer");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const amountNumber = Number(amount);
  const submit = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post("/payouts", {
          amount: amountNumber,
          method,
          accountDetails: details.trim(),
        })
      ).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["blueprint-tutor-financial-profile"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["blueprint-tutor-transactions"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["blueprint-tutor-payouts"],
        }),
      ]);
      setSubmitted(true);
    },
  });
  const canSubmit =
    amountNumber >= 10 && amountNumber <= balance && details.trim().length > 3;
  return (
    <RoutedPanel
      title={t("طلب سحب", "Request payout")}
      subtitle={t(
        "طلب مالي تؤكده حالة الخادم",
        "A financial request confirmed by server state",
      )}
      onClose={() => router.push(`/${lang}/teach/earnings`)}
      footer={
        !submitted ? (
          <button
            className="btn-primary blueprint-panel-submit"
            type="button"
            disabled={!canSubmit || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending
              ? t("جارٍ الإرسال…", "Submitting…")
              : t(
                  `طلب سحب ${formatCurrency(lang, amountNumber)}`,
                  `Request payout of ${formatCurrency(lang, amountNumber)}`,
                )}
          </button>
        ) : undefined
      }
    >
      {submitted ? (
        <div
          className="blueprint-result blueprint-result--success"
          role="status"
          aria-live="polite"
        >
          <span>✓</span>
          <h3>
            {t(
              "استلم الخادم طلب السحب",
              "Payout request received by the server",
            )}
          </h3>
          <p>
            {t(
              "سيظهر القرار النهائي في سجل السحب بعد المعالجة.",
              "The final outcome will appear in payout history after processing.",
            )}
          </p>
          <button
            className="btn-primary"
            type="button"
            onClick={() => router.push(`/${lang}/teach/earnings`)}
          >
            {t("عرض السجل", "View history")}
          </button>
        </div>
      ) : (
        <div className="blueprint-panel-form">
          <div className="blueprint-money-preview">
            <p>
              <span>{t("الرصيد المتاح", "Available balance")}</span>
              <strong>{formatCurrency(lang, balance)}</strong>
            </p>
          </div>
          <label>
            {t("المبلغ بالدولار", "Payout amount (USD)")}
            <input
              type="number"
              min="10"
              max={balance}
              step=".01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <fieldset>
            <legend>{t("طريقة الاستلام", "Receiving method")}</legend>
            <div className="blueprint-choice-row">
              {PAYOUT_METHODS.map((option) => (
                <button
                  type="button"
                  key={option.key}
                  aria-pressed={method === option.key}
                  onClick={() => setMethod(option.key)}
                >
                  {lang === "ar" ? option.ar : option.en}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            {t("تفاصيل الحساب", "Account details")}
            <input
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder={
                method === "bank_transfer"
                  ? "IBAN / account number"
                  : t("البريد أو رقم الهاتف", "Email or phone number")
              }
            />
          </label>
          {!stripeReady && (
            <p className="blueprint-note">
              {t(
                "Stripe Connect غير مكتمل. طرق السحب اليدوية تخضع لمراجعة الإدارة.",
                "Stripe Connect is incomplete. Manual payout methods remain subject to administrator review.",
              )}
            </p>
          )}
          {balance < 10 && (
            <p className="blueprint-error">
              {t(
                `الحد الأدنى للسحب هو ${formatCurrency(lang, 10)}.`,
                `The minimum payout amount is ${formatCurrency(lang, 10)}.`,
              )}
            </p>
          )}
          {submit.isError && (
            <p className="blueprint-error" role="alert">
              {(submit.error as { response?: { data?: { message?: string } } })
                ?.response?.data?.message ??
                t("تعذر إرسال طلب السحب.", "Payout request failed.")}
            </p>
          )}
        </div>
      )}
    </RoutedPanel>
  );
}
