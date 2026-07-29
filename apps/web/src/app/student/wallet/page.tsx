"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";
import { PaymentMethod } from "@mrh/types";
import { FocusDecisionStrip } from "@/components/shared/FocusDecisionStrip";
import { formatPaymentMethod } from "@/lib/format";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Backend PaymentMethod enum values — must match exactly
const PAYMENT_METHODS = [
  {
    key: PaymentMethod.CARD,
    labelAr: "بطاقة ائتمان",
    labelEn: "Credit Card",
    icon: "💳",
    requiresReceipt: false,
  },
  {
    key: PaymentMethod.PAYPAL,
    labelAr: "PayPal",
    labelEn: "PayPal",
    icon: "🅿️",
    requiresReceipt: false,
  },
  {
    key: PaymentMethod.VODAFONE,
    labelAr: "فودافون كاش",
    labelEn: "Vodafone Cash",
    icon: "📱",
    requiresReceipt: true,
  },
  {
    key: PaymentMethod.INSTAPAY,
    labelAr: "انستاباي",
    labelEn: "Instapay",
    icon: "⚡",
    requiresReceipt: true,
  },
  {
    key: PaymentMethod.BINANCE,
    labelAr: "بايننس",
    labelEn: "Binance",
    icon: "🪙",
    requiresReceipt: true,
  },
  {
    key: PaymentMethod.BANK,
    labelAr: "تحويل بنكي",
    labelEn: "Bank Transfer",
    icon: "🏦",
    requiresReceipt: true,
  },
] as const;

type MethodKey = (typeof PAYMENT_METHODS)[number]["key"];

type PaymentRecord = {
  id: string;
  amount: number;
  method: string;
  currency: string;
  status: string;
  receiptUrl?: string;
  adminNote?: string;
  rejectionReason?: string;
  createdAt: string;
};

type BalanceData = { balance: number; creditPrice: number; egpRate: number };
type PaymentMethodConfig = {
  type: string;
  label: string;
  enabled: boolean;
  details: string | null;
};

const statusConfig: Record<
  string,
  { ar: string; en: string; bg: string; color: string }
> = {
  approved: {
    ar: "مقبول",
    en: "Approved",
    bg: "var(--success-soft)",
    color: "var(--success)",
  },
  pending: {
    ar: "قيد الانتظار",
    en: "Pending",
    bg: "var(--warning-soft)",
    color: "var(--warning)",
  },
  rejected: {
    ar: "مرفوض",
    en: "Rejected",
    bg: "var(--danger-soft)",
    color: "var(--danger)",
  },
};

export default function StudentWalletPage() {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);

  // Form state
  const [selectedMethod, setSelectedMethod] = useState<MethodKey>(
    PaymentMethod.CARD,
  );
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USD" | "EGP">("USD");
  const [adminNote, setAdminNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const paypalCaptureStarted = useRef(false);

  useEffect(() => {
    const paymentId = new URLSearchParams(window.location.search).get(
      "paypalPaymentId",
    );
    if (!paymentId || paypalCaptureStarted.current) return;
    paypalCaptureStarted.current = true;
    void apiClient
      .post(`/payments/paypal/${encodeURIComponent(paymentId)}/capture`)
      .then(() => {
        setSuccessMsg(
          lang === "ar"
            ? "تم استلام دفعة PayPal وإضافتها إلى رصيدك."
            : "Your PayPal payment was received and added to your balance.",
        );
        void queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
        void queryClient.invalidateQueries({ queryKey: ["payment-history"] });
        window.history.replaceState({}, "", "/student/wallet");
      })
      .catch((error: { response?: { data?: { message?: string } } }) => {
        setSuccessMsg(
          error.response?.data?.message ||
            (lang === "ar"
              ? "تعذر التحقق من دفعة PayPal. لم تتم إضافة أي رصيد."
              : "PayPal verification failed. No balance was added."),
        );
      });
  }, [lang, queryClient]);

  const method = PAYMENT_METHODS.find((m) => m.key === selectedMethod)!;
  const requiresReceipt = method.requiresReceipt;

  const amountNum = parseFloat(amount) || 0;

  const { data: activePaymentMethods = [] } = useQuery<PaymentMethodConfig[]>({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      const { data } =
        await apiClient.get<PaymentMethodConfig[]>("/payment-methods");
      return data;
    },
  });
  const activeMethodTypes = useMemo(
    () => new Set(activePaymentMethods.map((item) => item.type)),
    [activePaymentMethods],
  );
  const visiblePaymentMethods = useMemo(
    () => PAYMENT_METHODS.filter((item) => activeMethodTypes.has(item.key)),
    [activeMethodTypes],
  );
  const selectedMethodConfig = activePaymentMethods.find(
    (item) => item.type === selectedMethod,
  );

  useEffect(() => {
    if (
      visiblePaymentMethods.length > 0 &&
      !activeMethodTypes.has(selectedMethod)
    ) {
      setSelectedMethod(visiblePaymentMethods[0].key);
    }
  }, [activeMethodTypes, selectedMethod, visiblePaymentMethods]);

  const { data: balance, isLoading: balanceLoading } = useQuery<BalanceData>({
    queryKey: ["wallet-balance"],
    queryFn: async () => {
      const { data } = await apiClient.get<BalanceData>("/students/balance");
      return data;
    },
  });

  const amountInUsd =
    currency === "EGP" ? amountNum / (balance?.egpRate ?? 50) : amountNum;

  const { data: paymentHistory = [], isLoading: historyLoading } = useQuery<
    PaymentRecord[]
  >({
    queryKey: ["payment-history"],
    queryFn: async () => {
      const { data } =
        await apiClient.get<PaymentRecord[]>("/payments/history");
      return data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("amount", String(amountNum));
      formData.append("method", selectedMethod);
      formData.append("currency", currency);
      if (adminNote.trim()) formData.append("adminNote", adminNote.trim());
      if (file) formData.append("screenshot", file);
      formData.append("idempotencyKey", crypto.randomUUID());

      const { data } = await apiClient.post<{ checkoutUrl?: string }>(
        "/payments/submit",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      return data;
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
      queryClient.invalidateQueries({ queryKey: ["payment-history"] });
      queryClient.invalidateQueries({ queryKey: ["student-balance"] });
      setSuccessMsg(
        requiresReceipt
          ? t(
              "تم إرسال طلب الدفع. سيتم مراجعته من قبل الإدارة.",
              "Payment request submitted. Admin will review it shortly.",
            )
          : t("تم إرسال طلب الدفع بنجاح", "Payment submitted successfully"),
      );
      // Reset form
      setAmount("");
      setAdminNote("");
      setFile(null);
      setFilePreview(null);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (
      error: { response?: { data?: { message?: string } } } & Error,
    ) => {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        t("حدث خطأ", "An error occurred");
      alert(msg);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setFilePreview(null);
    }
  };

  const canSubmit = amountNum >= 5 && (!requiresReceipt || file !== null);
  const walletAmount = amountInUsd > 0 ? amountInUsd.toFixed(2) : "0.00";
  const routedPanel = pathname.endsWith("/wallet/add");

  return (
    <div
      className={`max-w-4xl mx-auto p-4 md:p-6 space-y-8 ${routedPanel ? "wallet-route-panel" : ""}`}
    >
      <FocusDecisionStrip
        eyebrow={t("المحفظة", "Wallet")}
        title={t(
          "موّل خطوتك التعليمية التالية",
          "Fund your next learning step",
        )}
        description={
          requiresReceipt
            ? t(
                "تحتاج هذه الطريقة إلى إثبات تحويل، ولن يتغير الرصيد حتى تراجع الإدارة الطلب.",
                "This method needs transfer proof. Your balance changes only after admin review.",
              )
            : t(
                "ستنتقل إلى مزود الدفع الآمن، ثم نحدّث الرصيد بعد تحقق الخادم من العملية.",
                "You will continue with the secure payment provider. The server updates your balance only after verification.",
              )
        }
        facts={[
          {
            label: t("الرصيد الحالي", "Current balance"),
            value: balanceLoading
              ? "—"
              : `$${Number(balance?.balance ?? 0).toFixed(2)}`,
            tone: "success",
          },
          {
            label: t("طريقة الدفع", "Payment method"),
            value: lang === "ar" ? method.labelAr : method.labelEn,
          },
        ]}
        action={
          <Link
            className="btn-primary"
            href={
              pathname.includes("/learn/wallet")
                ? `/${lang}/learn/wallet/add`
                : "#wallet-top-up"
            }
          >
            {t("إضافة رصيد", "Add funds")}
          </Link>
        }
      />

      {/* Success message */}
      {successMsg && (
        <div
          className="p-4 rounded-xl flex items-start gap-3"
          style={{
            background: "var(--success-soft)",
            border:
              "1px solid color-mix(in srgb, var(--success) 20%, transparent)",
          }}
        >
          <svg
            className="w-5 h-5 shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="var(--success)"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--success)" }}
            >
              {successMsg}
            </p>
            {requiresReceipt && (
              <p className="text-xs mt-1" style={{ color: "var(--success)" }}>
                {t(
                  "سترى تحديث الرصيد بعد موافقة الإدارة.",
                  "Your balance will update once admin approves.",
                )}
              </p>
            )}
          </div>
          <button
            onClick={() => setSuccessMsg("")}
            className="ms-auto opacity-60 hover:opacity-100"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="var(--success)"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Payment form */}
      <div
        id="wallet-top-up"
        className="card p-6 space-y-5 scroll-mt-24 routed-payment-form"
      >
        {routedPanel && (
          <div className="routed-payment-header">
            <div>
              <strong>
                {t("إضافة رصيد إلى محفظة MRH", "Add Funds to MRH Wallet")}
              </strong>
              <span>
                {t("تأكيد الإيداع من الخادم", "Server-authoritative deposit")}
              </span>
            </div>
            <Link
              href={`/${lang}/learn/wallet`}
              aria-label={t("إغلاق", "Close")}
            >
              ×
            </Link>
          </div>
        )}
        <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
          {t("اشحن رصيدك", "Top Up Balance")}
        </h2>

        {/* Method selector */}
        <div>
          <label
            className="block text-sm font-medium mb-2"
            style={{ color: "var(--text-main)" }}
          >
            {t("طريقة الدفع", "Payment Method")}
          </label>
          <div className="flex flex-wrap gap-2">
            {visiblePaymentMethods.map((pm) => (
              <button
                key={pm.key}
                type="button"
                onClick={() => {
                  setSelectedMethod(pm.key);
                  setSuccessMsg("");
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  background:
                    selectedMethod === pm.key
                      ? "color-mix(in srgb, var(--signal) 15%, transparent)"
                      : "var(--bg-light)",
                  border:
                    selectedMethod === pm.key
                      ? "2px solid var(--signal)"
                      : "1px solid var(--border-color)",
                  color: "var(--text-main)",
                }}
              >
                <span>{pm.icon}</span>
                {lang === "ar" ? pm.labelAr : pm.labelEn}
              </button>
            ))}
          </div>
          {selectedMethodConfig?.details && (
            <p className="text-sm mt-3" style={{ color: "var(--text-muted)" }}>
              {selectedMethodConfig.details}
            </p>
          )}
        </div>

        {/* Amount + currency */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-main)" }}
            >
              {t("المبلغ", "Amount")}
            </label>
            <input
              type="number"
              min="5"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-field w-full"
              placeholder="0.00"
            />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {t("الحد الأدنى 5", "Minimum 5")}
            </p>
          </div>
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--text-main)" }}
            >
              {t("العملة", "Currency")}
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as "USD" | "EGP")}
              className="input-field w-full"
            >
              <option value="USD">USD $</option>
              <option value="EGP">EGP ج.م</option>
            </select>
          </div>
        </div>

        {/* Wallet balance preview */}
        {amountNum > 0 && (
          <p className="text-sm font-medium" style={{ color: "var(--signal)" }}>
            {t("سيُضاف إلى رصيدك", "Added to your wallet")}: ${walletAmount}
            {currency === "EGP" && (
              <span
                className="text-xs ms-2"
                style={{ color: "var(--text-muted)" }}
              >
                (1 USD = {balance?.egpRate ?? 50} EGP)
              </span>
            )}
          </p>
        )}

        {/* Receipt upload for manual methods */}
        {requiresReceipt && (
          <div
            className="p-4 rounded-xl"
            style={{
              background: "var(--bg-light)",
              border: "1px solid var(--border-color)",
            }}
          >
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--text-main)" }}
            >
              {t(
                "صورة الإيصال / التحويل",
                "Payment Receipt / Transfer Screenshot",
              )}
              <span className="text-xs ms-1" style={{ color: "var(--danger)" }}>
                *
              </span>
            </label>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              {t(
                "أرفق صورة إثبات الدفع. سيتم مراجعتها من قبل الإدارة لتفعيل الرصيد.",
                "Attach proof of payment. Admin will review it to activate your balance.",
              )}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileChange}
              className="text-sm w-full"
              style={{ color: "var(--text-main)" }}
            />
            {filePreview && (
              <div className="mt-3 relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={filePreview}
                  alt="receipt preview"
                  className="max-h-32 rounded-lg border"
                  style={{ borderColor: "var(--border-color)" }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setFilePreview(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs"
                  style={{ background: "var(--danger)" }}
                >
                  أ—
                </button>
              </div>
            )}
            {file && !filePreview && (
              <p className="text-xs mt-2" style={{ color: "var(--success)" }}>
                ✓ {file.name}
              </p>
            )}
          </div>
        )}

        {/* Admin note */}
        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: "var(--text-main)" }}
          >
            {t("ملاحظة للإدارة (اختياري)", "Note for admin (optional)")}
          </label>
          <input
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            className="input-field w-full"
            placeholder={t(
              "مثل: دفعت عبر فودافون على الرقم 01000000000",
              "e.g. Paid via Vodafone to 01000000000",
            )}
          />
        </div>

        <button
          type="button"
          onClick={() => submitMutation.mutate()}
          disabled={!canSubmit || submitMutation.isPending}
          className="btn-primary w-full py-3 disabled:opacity-50"
        >
          {submitMutation.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="w-4 h-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              {t("جاري الإرسال...", "Submitting...")}
            </span>
          ) : requiresReceipt ? (
            t("إرسال طلب الدفع", "Submit Payment Request")
          ) : (
            t("متابعة الدفع", "Proceed to Payment")
          )}
        </button>

        {requiresReceipt && (
          <div
            className="flex items-start gap-2 p-3 rounded-lg"
            style={{
              background: "color-mix(in srgb, var(--signal) 8%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--signal) 20%, transparent)",
            }}
          >
            <svg
              className="w-4 h-4 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="var(--signal)"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {t(
                "بعد الإرسال، ستنتظر موافقة الإدارة على الدفع. يتم مراجعة الطلبات خلال 24 ساعة عادةً.",
                "After submitting, you will wait for admin approval. Requests are usually reviewed within 24 hours.",
              )}
            </p>
          </div>
        )}
      </div>

      {/* Payment history */}
      <div>
        <h2
          className="text-lg font-bold mb-4"
          style={{ color: "var(--text-main)" }}
        >
          {t("سجل المدفوعات", "Payment History")}
        </h2>

        {historyLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-5">
                <div className="h-4 w-40 skeleton rounded mb-2" />
                <div className="h-3 w-24 skeleton rounded" />
              </div>
            ))}
          </div>
        ) : paymentHistory.length === 0 ? (
          <div className="card p-10 text-center">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
              style={{
                background:
                  "color-mix(in srgb, var(--signal) 10%, transparent)",
              }}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="var(--signal)"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m0 0v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5m18 0v9a2.25 2.25 0 01-2.25 2.25h-.75m-13.5-7.5h3.75m-3.75 3h3.75m-3.75 3h3.75"
                />
              </svg>
            </div>
            <p className="font-semibold" style={{ color: "var(--text-muted)" }}>
              {t("لا توجد مدفوعات بعد", "No payments yet")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {paymentHistory.map((payment) => {
              const cfg = statusConfig[payment.status] ?? statusConfig.pending;
              return (
                <div key={payment.id} className="card p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${cfg.color}15` }}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke={cfg.color}
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p
                          className="font-semibold text-sm"
                          style={{ color: "var(--text-main)" }}
                        >
                          {payment.amount.toFixed(2)} {payment.currency}
                        </p>
                        <div
                          className="flex items-center gap-2 text-xs mt-0.5"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <span>
                            {formatPaymentMethod(lang, payment.method)}
                          </span>
                          <span>·</span>
                          <span>
                            {new Date(payment.createdAt).toLocaleDateString(
                              lang === "ar" ? "ar-SA" : "en-US",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span
                      className="badge text-xs font-semibold shrink-0"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {lang === "ar" ? cfg.ar : cfg.en}
                    </span>
                  </div>

                  {payment.status === "rejected" && payment.rejectionReason && (
                    <div
                      className="mt-3 p-3 rounded-lg text-xs"
                      style={{
                        background: "var(--danger-soft)",
                        border:
                          "1px solid color-mix(in srgb, var(--danger) 15%, transparent)",
                        color: "var(--danger)",
                      }}
                    >
                      <span className="font-semibold">
                        {t("سبب الرفض: ", "Rejected: ")}
                      </span>
                      {payment.rejectionReason}
                    </div>
                  )}

                  {payment.status === "pending" && (
                    <p
                      className="text-xs mt-2"
                      style={{ color: "var(--warning)" }}
                    >
                      {t(
                        "⏳ قيد المراجعة من قبل الإدارة",
                        "⏳ Pending admin review",
                      )}
                    </p>
                  )}

                  {payment.receiptUrl && (
                    <a
                      href={payment.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs px-2 py-1 rounded-lg"
                      style={{
                        background:
                          "color-mix(in srgb, var(--signal) 10%, transparent)",
                        color: "var(--signal)",
                      }}
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      {t("عرض الإيصال", "View Receipt")}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
