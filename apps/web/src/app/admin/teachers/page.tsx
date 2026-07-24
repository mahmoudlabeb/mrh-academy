"use client";

import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/api-url";
import Link from "next/link";
import { useLanguage } from "@/contexts/language-context";

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

type TutorProfile = {
  userId: string;
  bio: string;
  specialization: string;
  languages: string[];
  hourlyRate: number;
  status: string;
  rejectionReason: string | null;
  documentUrl: string | null;
  user: User;
};

export default function AdminTeachersPage() {
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");
  const [selectedTutor, setSelectedTutor] = useState<TutorProfile | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const apiBaseUrl = getApiBaseUrl();

  const pendingQuery = useQuery({
    queryKey: ["pending-tutors"],
    queryFn: async () => {
      const { data } = await apiClient.get<TutorProfile[]>(
        "/admin/tutors/pending",
      );
      return data;
    },
  });

  const allQuery = useQuery({
    queryKey: ["all-tutors"],
    queryFn: async () => {
      const { data } = await apiClient.get<TutorProfile[]>("/admin/tutors");
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await apiClient.post(`/admin/tutors/${userId}/approve`);
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pending-tutors"] }),
        queryClient.invalidateQueries({ queryKey: ["all-tutors"] }),
      ]);
      setSelectedTutor(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({
      userId,
      reason,
    }: {
      userId: string;
      reason: string;
    }) => {
      const { data } = await apiClient.post(`/admin/tutors/${userId}/reject`, {
        reason,
      });
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pending-tutors"] }),
        queryClient.invalidateQueries({ queryKey: ["all-tutors"] }),
      ]);
      setSelectedTutor(null);
      setRejectReason("");
    },
  });

  const tutors = activeTab === "pending" ? pendingQuery.data : allQuery.data;
  const isLoading = pendingQuery.isLoading || allQuery.isLoading;

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-main)" }}
      >
        <svg
          className="w-8 h-8 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          style={{ color: "#D4A353" }}
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
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-main)" }}>
      <div className="dashboard-header">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: "#FFFFF0" }}>
                {t("إدارة المعلمين", "Manage tutors")}
              </h1>
              <p className="mt-1" style={{ color: "#E4CC9C" }}>
                {t(
                  "مراجعة وإدارة طلبات المعلمين",
                  "Review and manage tutor applications",
                )}
              </p>
            </div>
            <Link
              href="/admin"
              className="btn-secondary px-4 py-2 text-sm"
              style={{ borderColor: "#1D535B", color: "#FFFFF0" }}
            >
              {t("لوحة التحكم", "Dashboard")}
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div
          className="flex gap-1 mb-6 rounded-xl p-1 w-fit"
          style={{
            background: "var(--bg-light)",
            border: "1px solid var(--border-color)",
          }}
        >
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === "pending" ? "text-white shadow-sm" : ""
            }`}
            style={
              activeTab === "pending"
                ? { background: "#D4A353", color: "#0F3A40" }
                : { color: "var(--text-muted)" }
            }
          >
            {t("قيد الانتظار", "Pending")}
            {pendingQuery.data && (
              <span
                className="me-2 px-1.5 py-0.5 rounded-full text-xs"
                style={{ background: "rgba(0,0,0,0.15)" }}
              >
                {pendingQuery.data.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === "all" ? "text-white shadow-sm" : ""
            }`}
            style={
              activeTab === "all"
                ? { background: "#D4A353", color: "#0F3A40" }
                : { color: "var(--text-muted)" }
            }
          >
            {t("جميع المعلمين", "All tutors")}
          </button>
        </div>

        <div className="flex gap-6">
          <div className="flex-1 space-y-3">
            {tutors?.length === 0 ? (
              <div className="card p-12 text-center">
                <p
                  className="font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t("لم يتم العثور على معلمين", "No tutors found")}
                </p>
                <p
                  className="text-sm mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  {activeTab === "pending"
                    ? t("لا توجد طلبات معلقة", "No pending applications")
                    : t(
                        "لم يتم تسجيل معلمين بعد",
                        "No tutors have registered yet",
                      )}
                </p>
              </div>
            ) : (
              tutors?.map((tutor) => (
                <div
                  key={tutor.userId}
                  onClick={() => setSelectedTutor(tutor)}
                  className="card p-4 cursor-pointer"
                  style={
                    selectedTutor?.userId === tutor.userId
                      ? {
                          borderColor: "#D4A353",
                          boxShadow: "0 0 0 2px rgba(212, 163, 83,0.3)",
                        }
                      : {}
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                        style={{ background: "#D4A353" }}
                      >
                        {tutor.user.firstName[0]}
                      </div>
                      <div>
                        <h3
                          className="font-semibold"
                          style={{ color: "var(--text-main)" }}
                        >
                          {tutor.user.firstName} {tutor.user.lastName}
                        </h3>
                        <p
                          className="text-sm"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {tutor.specialization}
                        </p>
                      </div>
                    </div>
                    <span
                      className="badge text-xs font-semibold"
                      style={
                        tutor.status === "pending"
                          ? {
                              background: "rgba(234,179,8,0.1)",
                              color: "#eab308",
                              border: "1px solid rgba(234,179,8,0.2)",
                            }
                          : tutor.status === "approved"
                            ? {
                                background: "rgba(34,197,94,0.1)",
                                color: "#22c55e",
                                border: "1px solid rgba(34,197,94,0.2)",
                              }
                            : {
                                background: "rgba(239,68,68,0.1)",
                                color: "#ef4444",
                                border: "1px solid rgba(239,68,68,0.2)",
                              }
                      }
                    >
                      {tutor.status === "pending"
                        ? t("قيد الانتظار", "Pending")
                        : tutor.status === "approved"
                          ? t("معتمد", "Approved")
                          : t("مرفوض", "Rejected")}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedTutor && (
            <div className="w-96 shrink-0">
              <div
                className="card p-6 animate-scale-in"
                style={{ position: "sticky", top: "6rem" }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl"
                    style={{ background: "#D4A353" }}
                  >
                    {selectedTutor.user.firstName[0]}
                  </div>
                  <div>
                    <h2
                      className="text-xl font-bold"
                      style={{ color: "var(--text-main)" }}
                    >
                      {selectedTutor.user.firstName}{" "}
                      {selectedTutor.user.lastName}
                    </h2>
                    <span
                      className="badge text-xs font-semibold mt-1"
                      style={
                        selectedTutor.status === "pending"
                          ? {
                              background: "rgba(234,179,8,0.1)",
                              color: "#eab308",
                            }
                          : selectedTutor.status === "approved"
                            ? {
                                background: "rgba(34,197,94,0.1)",
                                color: "#22c55e",
                              }
                            : {
                                background: "rgba(239,68,68,0.1)",
                                color: "#ef4444",
                              }
                      }
                    >
                      {selectedTutor.status === "pending"
                        ? t("قيد الانتظار", "Pending")
                        : selectedTutor.status === "approved"
                          ? t("معتمد", "Approved")
                          : t("مرفوض", "Rejected")}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <Field label={t("البريد الإلكتروني", "Email")}>
                    {selectedTutor.user.email}
                  </Field>
                  <Field label={t("التخصص", "Specialization")}>
                    {selectedTutor.specialization}
                  </Field>
                  <Field label={t("اللغات", "Languages")}>
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {selectedTutor.languages.map((lang) => (
                        <span
                          key={lang}
                          className="badge"
                          style={{
                            background: "var(--bg-light)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {lang}
                        </span>
                      ))}
                    </div>
                  </Field>
                  <Field label={t("السعر في الساعة", "Hourly rate")}>
                    <span
                      className="text-lg font-bold"
                      style={{ color: "#D4A353" }}
                    >
                      ${selectedTutor.hourlyRate.toFixed(2)}
                    </span>
                    <span
                      className="text-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      /{t("ساعة", "hour")}
                    </span>
                  </Field>
                  <Field label={t("نبذة عني", "Biography")}>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {selectedTutor.bio}
                    </p>
                  </Field>
                  {selectedTutor.documentUrl && (
                    <Field label={t("المستند", "Document")}>
                      <a
                        href={selectedTutor.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link inline-flex items-center gap-1"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        {t("عرض المستند", "View document")}
                      </a>
                    </Field>
                  )}
                </div>

                {selectedTutor.status === "pending" && (
                  <div
                    className="mt-6 space-y-3 pt-6"
                    style={{ borderTop: "1px solid var(--border-color)" }}
                  >
                    <button
                      onClick={() =>
                        approveMutation.mutate(selectedTutor.userId)
                      }
                      disabled={approveMutation.isPending}
                      className="btn-primary w-full py-3"
                    >
                      {approveMutation.isPending ? (
                        <span className="flex items-center gap-2">
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
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          {t("جاري الموافقة...", "Approving...")}
                        </span>
                      ) : (
                        t("الموافقة على الطلب", "Approve application")
                      )}
                    </button>

                    <div className="relative">
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder={t(
                          "أدخل سبب الرفض...",
                          "Enter a rejection reason...",
                        )}
                        className="input-field resize-none"
                        rows={3}
                      />
                      <button
                        onClick={() =>
                          rejectMutation.mutate({
                            userId: selectedTutor.userId,
                            reason: rejectReason,
                          })
                        }
                        disabled={rejectMutation.isPending || !rejectReason}
                        className="btn-secondary w-full justify-center py-3 mt-2"
                        style={{
                          borderColor: "rgba(239,68,68,0.3)",
                          color: "#ef4444",
                        }}
                      >
                        {rejectMutation.isPending
                          ? t("جاري الرفض...", "Rejecting...")
                          : t("رفض الطلب", "Reject application")}
                      </button>
                    </div>

                    <a
                      href={`${apiBaseUrl}/admin/tutors/${selectedTutor.userId}/pdf`}
                      target="_blank"
                      className="btn-secondary w-full justify-center py-3"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      {t("تحميل PDF", "Download PDF")}
                    </a>
                  </div>
                )}

                {selectedTutor.status !== "pending" && (
                  <div
                    className="mt-6 pt-6 space-y-4"
                    style={{ borderTop: "1px solid var(--border-color)" }}
                  >
                    {selectedTutor.rejectionReason && (
                      <div
                        className="rounded-xl px-4 py-3"
                        style={{
                          background: "rgba(239,68,68,0.1)",
                          border: "1px solid rgba(239,68,68,0.2)",
                        }}
                      >
                        <p
                          className="text-xs font-medium mb-1"
                          style={{ color: "#ef4444" }}
                        >
                          {t("سبب الرفض", "Rejection reason")}
                        </p>
                        <p className="text-sm" style={{ color: "#ef4444" }}>
                          {selectedTutor.rejectionReason}
                        </p>
                      </div>
                    )}
                    <a
                      href={`${apiBaseUrl}/admin/tutors/${selectedTutor.userId}/pdf`}
                      target="_blank"
                      className="btn-secondary w-full justify-center py-3"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      {t("تحميل PDF", "Download PDF")}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p
        className="text-xs font-medium uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </p>
      <div className="mt-1 text-sm" style={{ color: "var(--text-main)" }}>
        {children}
      </div>
    </div>
  );
}
