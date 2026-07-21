"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";

type Payout = {
  id: string;
  tutorId: string;
  tutorName: string;
  amount: number;
  method: string | null;
  accountDetails: string | null;
  status: string;
  adminNote: string | null;
  errorMessage?: string;
  createdAt: string;
};

type TutorWallet = {
  tutorId: string;
  tutorName: string;
  courseId: string;
  courseTitle: string;
  sales: number;
  grossSales: number;
  academyCommission: number;
  tutorEarned: number;
  tutorAvailableBalance: number;
  saleSources: { tutor: number; academy: number };
};

const statusConfig: Record<
  string,
  { ar: string; en: string; bg: string; color: string }
> = {
  pending: {
    ar: "قيد الانتظار",
    en: "Pending",
    bg: "rgba(234,179,8,0.1)",
    color: "#eab308",
  },
  success: {
    ar: "مكتمل",
    en: "Completed",
    bg: "rgba(34,197,94,0.1)",
    color: "#22c55e",
  },
  failed: {
    ar: "فشل",
    en: "Failed",
    bg: "rgba(239,68,68,0.1)",
    color: "#ef4444",
  },
};

export default function AdminPayoutsPage() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>(
    {},
  );

  const { data: payouts = [], isLoading } = useQuery<Payout[]>({
    queryKey: ["admin-payouts"],
    queryFn: async () => {
      const { data } = await apiClient.get<Payout[]>("/payouts");
      return data;
    },
  });

  const { data: tutorWallets = [], isLoading: walletsLoading } = useQuery<
    TutorWallet[]
  >({
    queryKey: ["admin-tutor-wallets"],
    queryFn: async () => {
      const { data } = await apiClient.get<TutorWallet[]>(
        "/admin/payments/tutor-earnings",
      );
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/payouts/${id}/approve`);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-payouts"] }),
    onError: (
      error: { response?: { data?: { message?: string } } } & Error,
    ) => {
      alert(error?.response?.data?.message || error.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await apiClient.patch(`/payouts/${id}/reject`, { reason });
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-payouts"] });
      setRejectReasons((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    },
    onError: (
      error: { response?: { data?: { message?: string } } } & Error,
    ) => {
      alert(error?.response?.data?.message || error.message);
    },
  });

  const handleReject = (payout: Payout) => {
    const reason = rejectReasons[payout.id]?.trim() || "";
    if (
      !reason &&
      !window.confirm(t("رفض بدون سبب؟", "Reject without a reason?"))
    )
      return;
    rejectMutation.mutate({
      id: payout.id,
      reason: reason || "No reason provided",
    });
  };

  const pending = payouts.filter((p) => p.status === "pending");
  const processed = payouts.filter((p) => p.status !== "pending");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-2 border-[#D4A353] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2
          className="text-xl font-bold mb-1"
          style={{ color: "var(--text-main)" }}
        >
          {t("طلبات سحب الأرباح", "Tutor Payout Requests")}
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {t(
            "راجع واعتمد أو ارفض طلبات سحب أرباح المدرسين.",
            "Review and approve or reject tutor payout requests.",
          )}
        </p>
      </div>

      <section className="card p-5 space-y-4">
        <div>
          <h3
            className="text-lg font-bold"
            style={{ color: "var(--text-main)" }}
          >
            {t("محافظ المدرسين حسب الدورة", "Tutor wallets by course")}
          </h3>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {t(
              "إجمالي مستحقات كل مدرس محفوظة لكل دورة ومصدر بيع.",
              "Every completed sale is grouped by tutor and course with its exact commission source.",
            )}
          </p>
        </div>
        {walletsLoading ? (
          <div className="h-20 rounded-xl skeleton" />
        ) : tutorWallets.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {t("لا توجد مبيعات دورات بعد.", "No course sales yet.")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr style={{ background: "var(--bg-light)" }}>
                  {[
                    t("المدرس", "Tutor"),
                    t("الدورة", "Course"),
                    t("المبيعات", "Sales"),
                    t("إجمالي البيع", "Gross"),
                    t("حصة الأكاديمية", "Academy"),
                    t("ربح الدورة", "Course earned"),
                    t("الرصيد المتاح", "Available balance"),
                  ].map((label) => (
                    <th
                      key={label}
                      className="text-start px-3 py-3 font-semibold"
                      style={{ color: "var(--text-main)" }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tutorWallets.map((wallet) => (
                  <tr
                    key={`${wallet.tutorId}-${wallet.courseId}`}
                    style={{ borderBottom: "1px solid var(--border-color)" }}
                  >
                    <td
                      className="px-3 py-3 font-semibold"
                      style={{ color: "var(--text-main)" }}
                    >
                      {wallet.tutorName}
                    </td>
                    <td
                      className="px-3 py-3"
                      style={{ color: "var(--text-main)" }}
                    >
                      {wallet.courseTitle}
                    </td>
                    <td
                      className="px-3 py-3"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {wallet.sales}
                      <span className="text-xs ms-1">
                        ({wallet.saleSources.tutor} referral /{" "}
                        {wallet.saleSources.academy} academy)
                      </span>
                    </td>
                    <td
                      className="px-3 py-3"
                      style={{ color: "var(--text-main)" }}
                    >
                      ${wallet.grossSales.toFixed(2)}
                    </td>
                    <td className="px-3 py-3" style={{ color: "#D4A353" }}>
                      ${wallet.academyCommission.toFixed(2)}
                    </td>
                    <td
                      className="px-3 py-3 font-bold"
                      style={{ color: "#22c55e" }}
                    >
                      ${wallet.tutorEarned.toFixed(2)}
                    </td>
                    <td
                      className="px-3 py-3 font-bold"
                      style={{ color: "#22c55e" }}
                    >
                      ${wallet.tutorAvailableBalance.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pending */}
      <div>
        <h3
          className="text-base font-semibold mb-3"
          style={{ color: "var(--text-main)" }}
        >
          {t("قيد الانتظار", "Pending")}
          {pending.length > 0 && (
            <span
              className="ms-2 px-2 py-0.5 text-xs rounded-full font-bold"
              style={{ background: "#eab308", color: "#000" }}
            >
              {pending.length}
            </span>
          )}
        </h3>

        {pending.length === 0 ? (
          <div
            className="card p-8 text-center"
            style={{ color: "var(--text-muted)" }}
          >
            {t("لا توجد طلبات سحب معلقة", "No pending payout requests")}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {pending.map((payout) => (
              <div key={payout.id} className="card-gold p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p
                        className="font-bold text-xl"
                        style={{ color: "#D4A353" }}
                      >
                        ${payout.amount.toFixed(2)}
                      </p>
                      <span
                        className="badge text-xs"
                        style={{
                          background: "rgba(234,179,8,0.1)",
                          color: "#eab308",
                          border: "1px solid rgba(234,179,8,0.2)",
                        }}
                      >
                        {t("قيد الانتظار", "Pending")}
                      </span>
                    </div>
                    <p
                      className="font-semibold"
                      style={{ color: "var(--text-main)" }}
                    >
                      {payout.tutorName}
                    </p>
                    {payout.method && (
                      <p
                        className="text-sm mt-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {t("الطريقة:", "Method:")} {payout.method}
                      </p>
                    )}
                    {payout.accountDetails && (
                      <p
                        className="text-sm"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {t("تفاصيل الحساب:", "Account:")}{" "}
                        {payout.accountDetails}
                      </p>
                    )}
                    <p
                      className="text-xs mt-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {new Date(payout.createdAt).toLocaleString(
                        lang === "ar" ? "ar-EG" : "en-US",
                      )}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => approveMutation.mutate(payout.id)}
                      disabled={approveMutation.isPending}
                      className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-all"
                      style={{
                        background: "linear-gradient(135deg, #F3E1B9, #B89754)",
                        color: "#0F3A40",
                      }}
                    >
                      {t("اعتماد", "Approve")}
                    </button>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder={t("سبب الرفض...", "Reason...")}
                        value={rejectReasons[payout.id] ?? ""}
                        onChange={(e) =>
                          setRejectReasons((prev) => ({
                            ...prev,
                            [payout.id]: e.target.value,
                          }))
                        }
                        className="text-xs px-2 py-1.5 rounded-lg flex-1 min-w-0"
                        style={{
                          background: "var(--bg-main)",
                          border: "1px solid var(--border-color)",
                          color: "var(--text-main)",
                        }}
                      />
                      <button
                        onClick={() => handleReject(payout)}
                        disabled={rejectMutation.isPending}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-50"
                        style={{
                          borderColor: "rgba(239,68,68,0.4)",
                          color: "#ef4444",
                        }}
                      >
                        {t("رفض", "Reject")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Processed */}
      {processed.length > 0 && (
        <div>
          <h3
            className="text-base font-semibold mb-3"
            style={{ color: "var(--text-main)" }}
          >
            {t("السابق", "History")}
          </h3>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--bg-light)" }}>
                    <th
                      className="text-start px-4 py-3 font-semibold"
                      style={{ color: "var(--text-main)" }}
                    >
                      {t("المدرس", "Tutor")}
                    </th>
                    <th
                      className="text-start px-4 py-3 font-semibold"
                      style={{ color: "var(--text-main)" }}
                    >
                      {t("المبلغ", "Amount")}
                    </th>
                    <th
                      className="text-start px-4 py-3 font-semibold"
                      style={{ color: "var(--text-main)" }}
                    >
                      {t("الطريقة", "Method")}
                    </th>
                    <th
                      className="text-start px-4 py-3 font-semibold"
                      style={{ color: "var(--text-main)" }}
                    >
                      {t("الحالة", "Status")}
                    </th>
                    <th
                      className="text-start px-4 py-3 font-semibold"
                      style={{ color: "var(--text-main)" }}
                    >
                      {t("التاريخ", "Date")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {processed.map((payout) => {
                    const cfg =
                      statusConfig[payout.status] ?? statusConfig.pending;
                    return (
                      <tr
                        key={payout.id}
                        style={{
                          borderBottom: "1px solid var(--border-color)",
                        }}
                      >
                        <td
                          className="px-4 py-3 font-medium"
                          style={{ color: "var(--text-main)" }}
                        >
                          {payout.tutorName}
                        </td>
                        <td
                          className="px-4 py-3 font-bold"
                          style={{ color: "#22c55e" }}
                        >
                          ${payout.amount.toFixed(2)}
                        </td>
                        <td
                          className="px-4 py-3 text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {payout.method ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="badge text-xs"
                            style={{ background: cfg.bg, color: cfg.color }}
                          >
                            {lang === "ar" ? cfg.ar : cfg.en}
                          </span>
                        </td>
                        <td
                          className="px-4 py-3 text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {new Date(payout.createdAt).toLocaleDateString(
                            lang === "ar" ? "ar-EG" : "en-US",
                            { day: "numeric", month: "short", year: "numeric" },
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
