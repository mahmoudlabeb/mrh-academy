"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { PaymentMethod } from "@mrh/types";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import { RoutedPanel } from "@/components/shared/RoutedPanel";
import { formatCurrency } from "@/lib/format";

type Balance = { balance: number; creditPrice: number; egpRate: number | null };
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
type PayoutOption = {
  method: string;
  detailType: "email" | "account_details";
};

function useCopy() {
  const { lang } = useLanguage();
  const { user } = useAuth();
  return {
    lang,
    t: (ar: string, en: string) => (lang === "ar" ? ar : en),
    formatDate: (value: string) =>
      new Date(value).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
        timeZone: user?.timezone ?? "Africa/Cairo",
      }),
  };
}

function paymentMethodLabel(method: string, lang: "ar" | "en"): string {
  const labels: Record<string, { ar: string; en: string }> = {
    card: { ar: "بطاقة", en: "Card" },
    stripe: { ar: "بطاقة عبر Stripe", en: "Card via Stripe" },
    paypal: { ar: "PayPal", en: "PayPal" },
    vodafone_cash: { ar: "فودافون كاش", en: "Vodafone Cash" },
    vodafone: { ar: "فودافون كاش", en: "Vodafone Cash" },
    instapay: { ar: "إنستاباي", en: "Instapay" },
    bank_transfer: { ar: "تحويل بنكي", en: "Bank transfer" },
    bank: { ar: "تحويل بنكي", en: "Bank transfer" },
    wallet: { ar: "محفظة MRH", en: "MRH Wallet" },
  };
  return labels[method]?.[lang] ?? method.replaceAll("_", " ");
}

function paymentStatusLabel(status: string, lang: "ar" | "en"): string {
  const labels: Record<string, { ar: string; en: string }> = {
    pending: { ar: "قيد المراجعة", en: "Pending" },
    approved: { ar: "مقبولة", en: "Approved" },
    rejected: { ar: "مرفوضة", en: "Rejected" },
    failed: { ar: "فشلت", en: "Failed" },
    completed: { ar: "مكتملة", en: "Completed" },
    cancelled: { ar: "ملغاة", en: "Cancelled" },
    processing: { ar: "قيد المعالجة", en: "Processing" },
    partially_refunded: { ar: "مستردة جزئيًا", en: "Partially refunded" },
    refunded: { ar: "مستردة", en: "Refunded" },
    disputed: { ar: "متنازع عليها", en: "Disputed" },
  };
  return labels[status]?.[lang] ?? status;
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
  const searchParams = useSearchParams();
  const captureStarted = useRef<string | null>(null);
  const [paypalVerified, setPaypalVerified] = useState(
    searchParams.get("paypal") === "success",
  );
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
  const paypalPaymentId = searchParams.get("paypalPaymentId");
  const paypalCapture = useMutation({
    mutationFn: async (paymentId: string) =>
      (await apiClient.post(`/payments/paypal/${paymentId}/capture`)).data,
    onSuccess: () => {
      void Promise.all([balanceQuery.refetch(), paymentsQuery.refetch()]);
      setPaypalVerified(true);
      window.history.replaceState(
        window.history.state,
        "",
        `/${lang}/learn/wallet?paypal=success`,
      );
    },
  });
  useEffect(() => {
    if (
      !paypalPaymentId ||
      captureStarted.current === paypalPaymentId ||
      paypalCapture.isPending
    ) {
      return;
    }
    captureStarted.current = paypalPaymentId;
    paypalCapture.mutate(paypalPaymentId);
  }, [paypalCapture, paypalPaymentId]);
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
      {(paypalCapture.isPending ||
        paypalCapture.isError ||
        paypalVerified ||
        searchParams.get("paypalCancelled") === "1") && (
        <section
          className={
            paypalCapture.isError || searchParams.get("paypalCancelled") === "1"
              ? "blueprint-error"
              : "blueprint-result blueprint-result--success"
          }
          role={paypalCapture.isError ? "alert" : "status"}
          aria-live="polite"
        >
          {paypalCapture.isPending
            ? t(
                "جارٍ التحقق من دفعة PayPal مع الخادم…",
                "Verifying the PayPal payment with the server…",
              )
            : paypalCapture.isError
              ? t(
                  "تعذر التحقق من دفعة PayPal. لم تتم إضافة أي رصيد.",
                  "PayPal verification failed. No wallet credit was added.",
                )
              : searchParams.get("paypalCancelled") === "1"
                ? t(
                    "تم إلغاء عملية PayPal ولم يتغير رصيدك.",
                    "PayPal checkout was cancelled and your balance was unchanged.",
                  )
                : t(
                    "تم التحقق من دفعة PayPal وإضافة الرصيد.",
                    "PayPal verified the payment and your wallet was credited.",
                  )}
        </section>
      )}
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
        {!balanceQuery.isLoading && !balanceQuery.isError && balance === 0 && (
          <p>
            {t(
              "محفظتك فارغة. أضف رصيدًا لحجز أول درس.",
              "Your wallet is empty. Add funds to book your first lesson.",
            )}{" "}
            <Link href={`/${lang}/learn/wallet/add`}>
              {t("إضافة رصيد", "Add funds")}
            </Link>
          </p>
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
                <strong title={payment.id}>
                  {t(
                    `إضافة رصيد عبر ${paymentMethodLabel(payment.method, lang)} (${payment.currency})`,
                    `Wallet funding via ${paymentMethodLabel(payment.method, lang)} (${payment.currency})`,
                  )}
                </strong>
                <span>{paymentMethodLabel(payment.method, lang)}</span>
                <span>{formatDate(payment.createdAt)}</span>
                <strong>
                  {payment.amount >= 0 ? "+" : "−"}
                  {formatCurrency(
                    lang,
                    Math.abs(Number(payment.amount)),
                    2,
                    payment.currency === "EGP" ? "EGP" : "USD",
                  )}
                </strong>
                <span
                  className={`blueprint-status blueprint-status--${payment.status}`}
                >
                  {paymentStatusLabel(payment.status, lang)}
                </span>
              </div>
            ))}
          </div>
        </DataNotice>
      </section>
      {addFunds && (
        <AddFundsPanel
          balance={balance}
          egpRate={Number(balanceQuery.data?.egpRate) || null}
        />
      )}
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

function AddFundsPanel({
  balance,
  egpRate,
}: {
  balance: number;
  egpRate: number | null;
}) {
  const { lang, t } = useCopy();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("50");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [currency, setCurrency] = useState<"USD" | "EGP">("USD");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const idempotencyKeyRef = useRef(crypto.randomUUID());
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
  const validEgpRate =
    egpRate !== null && Number.isFinite(egpRate) && egpRate > 0
      ? egpRate
      : null;
  const walletCredit =
    currency === "EGP"
      ? validEgpRate
        ? amountNumber / validEgpRate
        : 0
      : amountNumber;
  const submit = useMutation({
    mutationFn: async () => {
      const data = new FormData();
      data.append("amount", String(amountNumber));
      if (!method) throw new Error("No enabled payment method selected");
      data.append("method", method);
      data.append("currency", currency);
      data.append("idempotencyKey", idempotencyKeyRef.current);
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
    (currency === "USD" || validEgpRate !== null) &&
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
                  `تأكيد إيداع ${formatCurrency(lang, amountNumber, 2, currency)}`,
                  `Confirm deposit of ${formatCurrency(lang, amountNumber, 2, currency)}`,
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
              {[5, 10, 20, 50, 100].map((value) => (
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
              <option disabled={validEgpRate === null}>EGP</option>
            </select>
            {currency === "EGP" && validEgpRate && (
              <small>1 USD = {validEgpRate} EGP</small>
            )}
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
                {formatCurrency(lang, balance + Math.max(0, walletCredit))}
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
  const pendingWithdrawals =
    payoutsQuery.data
      ?.filter((item) => ["pending", "processing"].includes(item.status))
      .reduce((total, item) => total + Number(item.amount), 0) ?? 0;
  const totalEarnings =
    transactionsQuery.data
      ?.filter(
        (item) =>
          ["lesson_earning", "course_earning"].includes(item.type) &&
          Number(item.amount) > 0,
      )
      .reduce((total, item) => total + Number(item.amount), 0) ?? 0;
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
      <div className="blueprint-stat-grid blueprint-stat-grid--financial">
        <section className="blueprint-financial-lead">
          <small>{t("متاح للسحب", "Available for payout")}</small>
          <strong>
            {profileQuery.isLoading ? "—" : formatCurrency(lang, balance)}
          </strong>
          <span className="blueprint-stat-caption">
            {t("جاهز لطلب السحب", "Ready to request")}
          </span>
        </section>
        <section>
          <small>{t("سحوبات قيد التنفيذ", "Pending withdrawals")}</small>
          <strong>
            {payoutsQuery.isLoading
              ? "—"
              : formatCurrency(lang, pendingWithdrawals)}
          </strong>
          <span className="blueprint-stat-caption">
            {t("بانتظار اكتمال المعالجة", "Awaiting processing")}
          </span>
        </section>
        <section>
          <small>{t("إجمالي الأرباح", "Total earnings")}</small>
          <strong>
            {transactionsQuery.isLoading
              ? "—"
              : formatCurrency(lang, totalEarnings)}
          </strong>
          <span className="blueprint-stat-caption">
            {t("من الدروس والدورات", "Across lessons and courses")}
          </span>
        </section>
        <section>
          <small>{t("طلبات السحب", "Payout requests")}</small>
          <strong>{payoutsQuery.data?.length ?? "—"}</strong>
          <span className="blueprint-stat-caption">
            {t("إجمالي الطلبات", "All payout requests")}
          </span>
        </section>
      </div>
      <section className="blueprint-table-section">
        <h2>{t("سجل الأرباح", "Earnings history")}</h2>
        <DataNotice
          loading={transactionsQuery.isLoading}
          error={transactionsQuery.isError}
          empty={!transactionsQuery.data?.length}
        >
          <div
            className="blueprint-data-scroll"
            role="region"
            aria-label={t("جدول سجل الأرباح", "Earnings history table")}
            tabIndex={0}
          >
            <div className="blueprint-data-table blueprint-data-table--earnings">
              {transactionsQuery.data?.map((transaction) => (
                <div
                  className="blueprint-data-row blueprint-data-row--earnings"
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
                    {paymentStatusLabel(transaction.status, lang)}
                  </span>
                </div>
              ))}
            </div>
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
          <div
            className="blueprint-data-scroll"
            role="region"
            aria-label={t("جدول سجل السحب", "Payout transfer history table")}
            tabIndex={0}
          >
            <div className="blueprint-data-table blueprint-data-table--payout">
              {payoutsQuery.data?.map((item) => (
                <div
                  className="blueprint-data-row blueprint-data-row--payout"
                  key={item.id}
                >
                  <strong>{paymentMethodLabel(item.method, lang)}</strong>
                  <span
                    className="blueprint-payout-account"
                    title={item.accountDetails}
                    dir="auto"
                  >
                    {item.accountDetails}
                  </span>
                  <span>{formatDate(item.createdAt)}</span>
                  <strong>{formatCurrency(lang, Number(item.amount))}</strong>
                  <span
                    className={`blueprint-status blueprint-status--${item.status}`}
                  >
                    {paymentStatusLabel(item.status, lang)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </DataNotice>
      </section>
      {payout && <PayoutPanel balance={balance} />}
    </main>
  );
}

const PAYOUT_METHODS = [
  { key: "paypal", ar: "PayPal", en: "PayPal" },
  { key: "bank_transfer", ar: "تحويل بنكي", en: "Bank transfer" },
  { key: "vodafone_cash", ar: "فودافون كاش", en: "Vodafone Cash" },
  { key: "instapay", ar: "إنستاباي", en: "Instapay" },
] as const;

function PayoutPanel({ balance }: { balance: number }) {
  const { lang, t } = useCopy();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(balance ? String(balance) : "");
  const [method, setMethod] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [validationVisible, setValidationVisible] = useState(false);
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const optionsQuery = useQuery({
    queryKey: ["blueprint-tutor-payout-options"],
    queryFn: async () =>
      (await apiClient.get<PayoutOption[]>("/payouts/options")).data,
    retry: false,
  });
  const visibleMethods = PAYOUT_METHODS.filter((option) =>
    optionsQuery.data?.some((item) => item.method === option.key),
  );
  useEffect(() => {
    if (!optionsQuery.isSuccess) return;
    const paypal = optionsQuery.data.find((item) => item.method === "paypal");
    const firstEnabled = paypal ?? optionsQuery.data[0];
    setMethod((current) =>
      current && optionsQuery.data.some((item) => item.method === current)
        ? current
        : (firstEnabled?.method ?? null),
    );
  }, [optionsQuery.data, optionsQuery.isSuccess]);
  useEffect(() => {
    setAmount((current) => current || (balance ? String(balance) : ""));
  }, [balance]);
  const amountNumber = Number(amount);
  const submit = useMutation({
    mutationFn: async () => {
      if (!method) throw new Error("No payout method is available");
      return (
        await apiClient.post("/payouts", {
          amount: amountNumber,
          method,
          idempotencyKey: idempotencyKeyRef.current,
          ...(method === "paypal"
            ? { paypalEmail: details.trim() }
            : { accountDetails: details.trim() }),
        })
      ).data;
    },
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
  const validPayPalEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.trim());
  const detailsInvalid =
    method === "paypal" ? !validPayPalEmail : details.trim().length <= 3;
  const canSubmit =
    optionsQuery.isSuccess &&
    method !== null &&
    amountNumber >= 10 &&
    amountNumber <= balance &&
    !detailsInvalid;
  const amountInvalid =
    !Number.isFinite(amountNumber) ||
    amountNumber < 10 ||
    amountNumber > balance;
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
            disabled={submit.isPending}
            onClick={() => {
              setValidationVisible(true);
              if (canSubmit) submit.mutate();
            }}
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
              aria-invalid={validationVisible && amountInvalid}
              aria-describedby={
                validationVisible && amountInvalid
                  ? "payout-amount-error"
                  : undefined
              }
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          {validationVisible && amountInvalid && (
            <p
              id="payout-amount-error"
              className="blueprint-error"
              role="alert"
            >
              {amountNumber < 10
                ? t(
                    `أدخل مبلغاً لا يقل عن ${formatCurrency(lang, 10)}.`,
                    `Enter at least ${formatCurrency(lang, 10)}.`,
                  )
                : t(
                    "لا يمكن أن يتجاوز مبلغ السحب الرصيد المتاح.",
                    "The payout amount cannot exceed your available balance.",
                  )}
            </p>
          )}
          <fieldset>
            <legend>{t("طريقة الاستلام", "Receiving method")}</legend>
            {optionsQuery.isLoading ? (
              <div
                className="skeleton h-12 rounded"
                aria-label={t("جارٍ تحميل طرق السحب", "Loading payout methods")}
              />
            ) : optionsQuery.isError ? (
              <div className="blueprint-inline-notice" role="alert">
                <strong>
                  {t(
                    "تعذر تحميل طرق السحب",
                    "Payout methods could not be loaded",
                  )}
                </strong>
                <span>
                  {t(
                    "تحقق من اتصالك ثم أعد المحاولة. لم يتم تغيير أي بيانات.",
                    "Check your connection and try again. No financial data was changed.",
                  )}
                </span>
                <button
                  className="btn-secondary blueprint-inline-notice__action"
                  type="button"
                  disabled={optionsQuery.isFetching}
                  onClick={() => void optionsQuery.refetch()}
                >
                  {optionsQuery.isFetching
                    ? t("جارٍ إعادة المحاولة…", "Retrying…")
                    : t("إعادة المحاولة", "Retry")}
                </button>
              </div>
            ) : visibleMethods.length > 0 ? (
              <div className="blueprint-choice-row">
                {visibleMethods.map((option) => (
                  <button
                    type="button"
                    key={option.key}
                    aria-pressed={method === option.key}
                    onClick={() => {
                      setMethod(option.key);
                      setDetails("");
                      setValidationVisible(false);
                    }}
                  >
                    {lang === "ar" ? option.ar : option.en}
                  </button>
                ))}
              </div>
            ) : (
              <div
                className="blueprint-inline-notice"
                role="status"
                aria-live="polite"
              >
                <strong>
                  {t(
                    "إعدادات السحب غير متاحة حالياً",
                    "Payout setup is not available right now",
                  )}
                </strong>
                <span>
                  {t(
                    "تواصل مع الدعم لتفعيل طريقة سحب آمنة لحسابك.",
                    "Contact support to enable a secure payout method for your account.",
                  )}
                </span>
              </div>
            )}
          </fieldset>
          {method && (
            <label>
              {method === "paypal"
                ? t("بريد PayPal", "PayPal email")
                : t("تفاصيل الحساب", "Account details")}
              <input
                type={method === "paypal" ? "email" : "text"}
                value={details}
                aria-invalid={validationVisible && detailsInvalid}
                aria-describedby={
                  validationVisible && detailsInvalid
                    ? "payout-details-error"
                    : undefined
                }
                onChange={(event) => setDetails(event.target.value)}
                placeholder={
                  method === "bank_transfer"
                    ? "IBAN / account number"
                    : method === "paypal"
                      ? "name@example.com"
                      : t("البريد أو رقم الهاتف", "Email or phone number")
                }
              />
            </label>
          )}
          {validationVisible && method && detailsInvalid && (
            <p
              id="payout-details-error"
              className="blueprint-inline-notice"
              role="alert"
            >
              {t(
                method === "paypal"
                  ? "أضف بريد PayPal صالحاً لإكمال إعداد السحب."
                  : "أضف تفاصيل حساب صالحة لإكمال إعداد السحب.",
                method === "paypal"
                  ? "Add a valid PayPal email to complete your payout setup."
                  : "Add valid account details to complete your payout setup.",
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
