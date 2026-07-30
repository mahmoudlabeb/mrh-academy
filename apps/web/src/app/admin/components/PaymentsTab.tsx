"use client";

import {
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";

type LedgerStatusFilter =
  "all" | "succeeded" | "pending" | "failed" | "refunded" | "disputed";

type LedgerUser = {
  id: string;
  name: string;
  email?: string;
};

type LedgerEntry = {
  id: string;
  eventKey: string;
  transactionType: string;
  status: string;
  provider: string;
  method: string;
  amount: number;
  currency: string;
  user: LedgerUser | null;
  tutor: Omit<LedgerUser, "email"> | null;
  providerReferenceId: string | null;
  providerStatus: string | null;
  paymentId: string | null;
  course: { id: string; title: string } | null;
  enrollmentId: string | null;
  lesson: {
    id: string;
    scheduledTime: string;
    durationMinutes: number;
  } | null;
  payoutId: string | null;
  adminCommission: number;
  tutorShare: number;
  balanceBefore: number | null;
  balanceAfter: number | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  audit?: Record<string, string | number | boolean | null>;
};

type LedgerResponse = {
  items: LedgerEntry[];
  total: number;
  page: number;
  limit: number;
};

const PAGE_SIZE = 50;

export default function PaymentsTab() {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const [status, setStatus] = useState<LedgerStatusFilter>("all");
  const [method, setMethod] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const canView =
    user?.role === "admin" ||
    (user?.role === "subadmin" &&
      user.assignedPermissions?.includes("manage_payments"));

  const paymentsQuery = useQuery({
    queryKey: ["admin-payment-ledger", status, method, deferredSearch, page],
    enabled: canView,
    queryFn: async () => {
      const { data } = await apiClient.get<LedgerResponse>("/admin/payments", {
        params: {
          page,
          limit: PAGE_SIZE,
          status,
          ...(method === "all" ? {} : { method }),
          ...(deferredSearch ? { search: deferredSearch } : {}),
        },
      });
      return data;
    },
  });

  if (!canView) {
    return (
      <section className="ops-ledger-state" role="alert">
        <span aria-hidden="true">!</span>
        <div>
          <h2>{t("لا يمكن عرض السجل المالي", "Payment ledger unavailable")}</h2>
          <p>
            {t(
              "يتطلب هذا السجل صلاحية إدارة المدفوعات الصادرة من الخادم.",
              "This audit record requires the server-issued manage-payments permission.",
            )}
          </p>
        </div>
      </section>
    );
  }

  const entries = paymentsQuery.data?.items ?? [];
  const total = paymentsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filteredEmpty =
    status !== "all" || method !== "all" || deferredSearch.length > 0;

  const setFilter = (next: LedgerStatusFilter) => {
    setStatus(next);
    setPage(1);
  };

  return (
    <div className="ops-payment-ledger">
      <header className="ops-payment-ledger__intro">
        <div>
          <p>
            {t(
              "سجل تلقائي غير قابل للاعتماد اليدوي",
              "Automatic, provider-authoritative audit record",
            )}
          </p>
          <strong>
            {paymentsQuery.isLoading
              ? t("جارٍ التحقق…", "Verifying…")
              : t(`${total} حركة مالية`, `${total} financial events`)}
          </strong>
        </div>
        <label className="ops-ledger-search">
          <span>{t("البحث في السجل", "Search ledger")}</span>
          <input
            type="search"
            value={search}
            placeholder={t(
              "اسم، بريد، مرجع أو دورة",
              "Name, email, reference, or course",
            )}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </header>

      <div className="ops-payment-ledger__controls">
        <div
          className="ops-ledger-filters"
          role="group"
          aria-label={t("تصفية حسب حالة الدفع", "Filter by payment status")}
        >
          {(
            [
              ["all", "الكل", "All"],
              ["succeeded", "مدفوعة / ناجحة", "Paid / succeeded"],
              [
                "pending",
                "بانتظار تأكيد المزوّد",
                "Pending provider confirmation",
              ],
              ["failed", "فشلت", "Failed"],
              ["refunded", "مستردة", "Refunded"],
              ["disputed", "نزاع / استرداد قسري", "Disputed / chargeback"],
            ] as const
          ).map(([key, ar, en]) => (
            <button
              key={key}
              type="button"
              aria-pressed={status === key}
              onClick={() => setFilter(key)}
            >
              {lang === "ar" ? ar : en}
            </button>
          ))}
        </div>
        <label className="ops-ledger-method">
          <span>{t("المزوّد / الطريقة", "Provider / method")}</span>
          <select
            value={method}
            onChange={(event) => {
              setMethod(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">{t("كل الطرق", "All methods")}</option>
            <option value="stripe">Stripe</option>
            <option value="paypal">PayPal</option>
            <option value="wallet">{t("محفظة MRH", "MRH Wallet")}</option>
            <option value="manual">
              {t("تحويلات تاريخية", "Historical manual transfers")}
            </option>
          </select>
        </label>
      </div>

      {paymentsQuery.isLoading ? (
        <LedgerLoading t={t} />
      ) : paymentsQuery.isError ? (
        <section
          className="ops-ledger-state ops-ledger-state--error"
          role="alert"
        >
          <span aria-hidden="true">!</span>
          <div>
            <h2>
              {t("تعذر تحميل سجل المدفوعات", "Payment ledger did not load")}
            </h2>
            <p>
              {t(
                "لم تتغير أي بيانات مالية. تحقق من الاتصال ثم أعد المحاولة.",
                "No financial data changed. Check the connection and try again.",
              )}
            </p>
            <button
              type="button"
              className="btn-secondary"
              disabled={paymentsQuery.isFetching}
              onClick={() => void paymentsQuery.refetch()}
            >
              {paymentsQuery.isFetching
                ? t("جارٍ إعادة المحاولة…", "Retrying…")
                : t("إعادة المحاولة", "Retry")}
            </button>
          </div>
        </section>
      ) : entries.length === 0 ? (
        <section className="ops-ledger-state">
          <span aria-hidden="true">◎</span>
          <div>
            <h2>
              {filteredEmpty
                ? t(
                    "لا توجد نتائج بهذه التصفية",
                    "No events match these filters",
                  )
                : t(
                    "لم تُسجل حركات مالية بعد",
                    "No financial events have been recorded yet",
                  )}
            </h2>
            <p>
              {filteredEmpty
                ? t(
                    "غيّر الحالة أو الطريقة أو عبارة البحث لعرض نتائج أخرى.",
                    "Change the status, method, or search to see other results.",
                  )
                : t(
                    "ستظهر محاولات مزوّدي الدفع والمشتريات والاستردادات هنا تلقائياً.",
                    "Provider attempts, purchases, and reversals will appear here automatically.",
                  )}
            </p>
          </div>
        </section>
      ) : (
        <>
          <div
            className="ops-ledger-table-wrap"
            role="region"
            aria-label={t("جدول سجل المدفوعات", "Payment ledger table")}
            tabIndex={0}
          >
            <table className="ops-ledger-table">
              <thead>
                <tr>
                  <th>{t("التاريخ والوقت", "Date & time")}</th>
                  <th>{t("المستخدم / الطالب", "User / student")}</th>
                  <th>{t("نوع الدفع", "Payment type")}</th>
                  <th>{t("المزوّد / الطريقة", "Provider / method")}</th>
                  <th>{t("المبلغ", "Amount")}</th>
                  <th>{t("الحالة", "Status")}</th>
                  <th>{t("مرجع المزوّد", "Provider reference")}</th>
                  <th>{t("الارتباط", "Related record")}</th>
                  <th>{t("عمولة الإدارة", "Admin commission")}</th>
                  <th>{t("حصة المعلم", "Tutor share")}</th>
                  <th>{t("التفاصيل", "Details")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label={t("التاريخ والوقت", "Date & time")}>
                      <time dateTime={entry.occurredAt}>
                        {formatDateTime(entry.occurredAt, lang)}
                      </time>
                    </td>
                    <td data-label={t("المستخدم / الطالب", "User / student")}>
                      <strong>
                        {entry.user?.name ?? entry.tutor?.name ?? "—"}
                      </strong>
                      {entry.user?.email ? (
                        <small>
                          <bdi>{entry.user.email}</bdi>
                        </small>
                      ) : null}
                    </td>
                    <td data-label={t("نوع الدفع", "Payment type")}>
                      {transactionTypeLabel(entry.transactionType, lang)}
                    </td>
                    <td
                      data-label={t("المزوّد / الطريقة", "Provider / method")}
                    >
                      <strong>{providerLabel(entry.provider, lang)}</strong>
                      <small>{methodLabel(entry.method, lang)}</small>
                    </td>
                    <td data-label={t("المبلغ", "Amount")}>
                      <bdi className="ops-ledger-amount">
                        {formatMoney(entry.amount, entry.currency, lang)}
                      </bdi>
                    </td>
                    <td data-label={t("الحالة", "Status")}>
                      <StatusBadge status={entry.status} lang={lang} />
                    </td>
                    <td data-label={t("مرجع المزوّد", "Provider reference")}>
                      <bdi
                        className="ops-ledger-reference"
                        title={entry.providerReferenceId ?? undefined}
                      >
                        {shortReference(entry.providerReferenceId)}
                      </bdi>
                    </td>
                    <td data-label={t("الارتباط", "Related record")}>
                      {relatedLabel(entry, lang)}
                    </td>
                    <td data-label={t("عمولة الإدارة", "Admin commission")}>
                      <bdi>
                        {formatMoney(entry.adminCommission, "USD", lang)}
                      </bdi>
                    </td>
                    <td data-label={t("حصة المعلم", "Tutor share")}>
                      <bdi>{formatMoney(entry.tutorShare, "USD", lang)}</bdi>
                    </td>
                    <td data-label={t("التفاصيل", "Details")}>
                      <button
                        type="button"
                        className="ops-ledger-details-button"
                        onClick={(event) => {
                          returnFocusRef.current = event.currentTarget;
                          setSelectedId(entry.id);
                        }}
                      >
                        {t("عرض السجل", "View audit")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav
            className="ops-ledger-pagination"
            aria-label={t("صفحات سجل المدفوعات", "Payment ledger pages")}
          >
            <button
              type="button"
              disabled={page <= 1 || paymentsQuery.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              {t("السابق", "Previous")}
            </button>
            <span>
              {t(
                `صفحة ${page} من ${totalPages}`,
                `Page ${page} of ${totalPages}`,
              )}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || paymentsQuery.isFetching}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              {t("التالي", "Next")}
            </button>
          </nav>
        </>
      )}

      {selectedId ? (
        <PaymentDetailsDrawer
          id={selectedId}
          lang={lang}
          onClose={() => {
            setSelectedId(null);
            requestAnimationFrame(() => returnFocusRef.current?.focus());
          }}
        />
      ) : null}
    </div>
  );
}

function LedgerLoading({ t }: { t: (ar: string, en: string) => string }) {
  return (
    <div
      className="ops-ledger-loading"
      aria-label={t("جارٍ تحميل سجل المدفوعات", "Loading payment ledger")}
      aria-busy="true"
    >
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}

function PaymentDetailsDrawer({
  id,
  lang,
  onClose,
}: {
  id: string;
  lang: "ar" | "en";
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const detailsQuery = useQuery({
    queryKey: ["admin-payment-ledger-details", id],
    queryFn: async () =>
      (await apiClient.get<LedgerEntry>(`/admin/payments/${id}`)).data,
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const stopPropagation = (
    event: ReactKeyboardEvent<HTMLElement> | ReactMouseEvent<HTMLElement>,
  ) => event.stopPropagation();
  const entry = detailsQuery.data;

  return (
    <div
      className="ops-payment-drawer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={panelRef}
        className="ops-payment-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-audit-title"
        onMouseDown={stopPropagation}
        onKeyDown={stopPropagation}
      >
        <header>
          <div>
            <p>{t("تفاصيل تدقيق آمنة", "Safe audit details")}</p>
            <h2 id="payment-audit-title">
              {t("سجل الحركة المالية", "Financial event record")}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label={t("إغلاق التفاصيل", "Close details")}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {detailsQuery.isLoading ? (
          <div className="ops-ledger-loading" aria-busy="true">
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        ) : detailsQuery.isError || !entry ? (
          <section
            className="ops-ledger-state ops-ledger-state--error"
            role="alert"
          >
            <span aria-hidden="true">!</span>
            <div>
              <h3>{t("تعذر تحميل التفاصيل", "Audit details did not load")}</h3>
              <p>
                {t(
                  "لم تتغير أي بيانات. أعد المحاولة أو أغلق اللوحة.",
                  "No data changed. Retry or close the drawer.",
                )}
              </p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void detailsQuery.refetch()}
              >
                {t("إعادة المحاولة", "Retry")}
              </button>
            </div>
          </section>
        ) : (
          <div className="ops-payment-drawer__content">
            <section className="ops-payment-drawer__summary">
              <div>
                <span>{transactionTypeLabel(entry.transactionType, lang)}</span>
                <strong>
                  <bdi>{formatMoney(entry.amount, entry.currency, lang)}</bdi>
                </strong>
              </div>
              <StatusBadge status={entry.status} lang={lang} />
            </section>

            <AuditSection title={t("العملية", "Transaction")}>
              <AuditFact
                label={t("وقت الحدث", "Event time")}
                value={formatDateTime(entry.occurredAt, lang)}
              />
              <AuditFact
                label={t("المستخدم", "User")}
                value={entry.user?.name ?? entry.tutor?.name ?? "—"}
              />
              <AuditFact
                label={t("المزوّد", "Provider")}
                value={providerLabel(entry.provider, lang)}
              />
              <AuditFact
                label={t("الطريقة", "Method")}
                value={methodLabel(entry.method, lang)}
              />
              <AuditFact
                label={t("حالة المزوّد", "Provider status")}
                value={entry.providerStatus ?? "—"}
                isolate
              />
            </AuditSection>

            <AuditSection title={t("المراجع الآمنة", "Safe references")}>
              <AuditFact
                label={t("مرجع المزوّد", "Provider reference")}
                value={entry.providerReferenceId ?? "—"}
                isolate
              />
              <AuditFact
                label={t("معرف الدفع", "Payment ID")}
                value={entry.paymentId ?? "—"}
                isolate
              />
              <AuditFact
                label={t("مفتاح حدث السجل", "Ledger event key")}
                value={entry.eventKey}
                isolate
              />
            </AuditSection>

            <AuditSection
              title={t("الارتباط والتوزيع", "Relation & allocation")}
            >
              <AuditFact
                label={t("الدورة", "Course")}
                value={entry.course?.title ?? "—"}
              />
              <AuditFact
                label={t("الدرس / الحجز", "Lesson / booking")}
                value={
                  entry.lesson
                    ? formatDateTime(entry.lesson.scheduledTime, lang)
                    : "—"
                }
              />
              <AuditFact
                label={t("المعلم", "Tutor")}
                value={entry.tutor?.name ?? "—"}
              />
              <AuditFact
                label={t("عمولة الإدارة", "Admin commission")}
                value={formatMoney(entry.adminCommission, "USD", lang)}
                isolate
              />
              <AuditFact
                label={t("حصة المعلم", "Tutor share")}
                value={formatMoney(entry.tutorShare, "USD", lang)}
                isolate
              />
            </AuditSection>

            {entry.balanceBefore !== null || entry.balanceAfter !== null ? (
              <AuditSection title={t("أثر المحفظة", "Wallet effect")}>
                <AuditFact
                  label={t("الرصيد قبل", "Balance before")}
                  value={
                    entry.balanceBefore === null
                      ? "—"
                      : formatMoney(entry.balanceBefore, "USD", lang)
                  }
                  isolate
                />
                <AuditFact
                  label={t("الرصيد بعد", "Balance after")}
                  value={
                    entry.balanceAfter === null
                      ? "—"
                      : formatMoney(entry.balanceAfter, "USD", lang)
                  }
                  isolate
                />
              </AuditSection>
            ) : null}

            {entry.audit && Object.keys(entry.audit).length > 0 ? (
              <AuditSection title={t("بيانات التدقيق", "Audit metadata")}>
                {Object.entries(entry.audit).map(([key, value]) => (
                  <AuditFact
                    key={key}
                    label={humanize(key)}
                    value={value === null ? "—" : String(value)}
                    isolate
                  />
                ))}
              </AuditSection>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  );
}

function AuditSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="ops-payment-drawer__section">
      <h3>{title}</h3>
      <dl>{children}</dl>
    </section>
  );
}

function AuditFact({
  label,
  value,
  isolate = false,
}: {
  label: string;
  value: string;
  isolate?: boolean;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{isolate ? <bdi>{value}</bdi> : value}</dd>
    </div>
  );
}

function StatusBadge({ status, lang }: { status: string; lang: "ar" | "en" }) {
  const label = statusLabel(status, lang);
  const icon =
    status === "succeeded"
      ? "✓"
      : status === "pending"
        ? "◷"
        : ["refunded", "partially_refunded", "reversed"].includes(status)
          ? "↩"
          : status === "disputed"
            ? "!"
            : "×";
  return (
    <span className={`ops-ledger-status ops-ledger-status--${status}`}>
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}

function statusLabel(status: string, lang: "ar" | "en") {
  const labels: Record<string, [string, string]> = {
    succeeded: ["ناجحة", "Succeeded"],
    pending: ["بانتظار تأكيد المزوّد", "Pending provider confirmation"],
    failed: ["فشلت", "Failed"],
    cancelled: ["ملغاة", "Cancelled"],
    partially_refunded: ["مستردة جزئياً", "Partially refunded"],
    refunded: ["مستردة", "Refunded"],
    disputed: ["متنازع عليها", "Disputed / chargeback"],
    reversed: ["معكوسة", "Reversed"],
  };
  return labels[status]?.[lang === "ar" ? 0 : 1] ?? humanize(status);
}

function transactionTypeLabel(type: string, lang: "ar" | "en") {
  const labels: Record<string, [string, string]> = {
    wallet_top_up: ["شحن محفظة", "Wallet top-up"],
    course_purchase: ["شراء دورة", "Course purchase"],
    lesson_booking: ["حجز درس مباشر", "Live lesson booking"],
    refund: ["استرداد", "Refund"],
    dispute: ["نزاع / استرداد قسري", "Dispute / chargeback"],
    tutor_earning_release: ["تحرير ربح المعلم", "Tutor earning release"],
    tutor_payout: ["سحب معلم", "Tutor payout"],
    platform_payout: ["سحب عمولة المنصة", "Platform payout"],
    payout_reversal: ["عكس سحب", "Payout reversal"],
  };
  return labels[type]?.[lang === "ar" ? 0 : 1] ?? humanize(type);
}

function providerLabel(provider: string, lang: "ar" | "en") {
  const labels: Record<string, [string, string]> = {
    stripe: ["Stripe", "Stripe"],
    paypal: ["PayPal", "PayPal"],
    internal: ["محفظة MRH", "MRH Wallet"],
    manual: ["تحويل تاريخي", "Historical transfer"],
    legacy_manual: ["تحويل تاريخي", "Historical transfer"],
  };
  return labels[provider]?.[lang === "ar" ? 0 : 1] ?? humanize(provider);
}

function methodLabel(method: string, lang: "ar" | "en") {
  const labels: Record<string, [string, string]> = {
    card: ["بطاقة بنكية", "Bank card"],
    paypal: ["PayPal", "PayPal"],
    wallet: ["رصيد المحفظة", "Wallet balance"],
    stripe_connect: ["تحويل Stripe", "Stripe transfer"],
    bank_transfer: ["تحويل بنكي", "Bank transfer"],
    instapay: ["إنستاباي", "Instapay"],
    vodafone_cash: ["فودافون كاش", "Vodafone Cash"],
  };
  return labels[method]?.[lang === "ar" ? 0 : 1] ?? humanize(method);
}

function relatedLabel(entry: LedgerEntry, lang: "ar" | "en") {
  if (entry.course) return entry.course.title;
  if (entry.lesson)
    return `${lang === "ar" ? "درس" : "Lesson"} · ${formatDateTime(
      entry.lesson.scheduledTime,
      lang,
    )}`;
  if (entry.payoutId) return lang === "ar" ? "طلب سحب" : "Payout";
  return "—";
}

function formatMoney(amount: number, currency: string, lang: "ar" | "en") {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

function formatDateTime(value: string, lang: "ar" | "en") {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function shortReference(value: string | null) {
  if (!value) return "—";
  if (value.length <= 18) return value;
  return `${value.slice(0, 9)}…${value.slice(-6)}`;
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
}
