"use client";

import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/api-url";
import Link from "next/link";

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
      await queryClient.invalidateQueries({ queryKey: ["pending-tutors"] });
      await queryClient.invalidateQueries({ queryKey: ["all-tutors"] });
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
      await queryClient.invalidateQueries({ queryKey: ["pending-tutors"] });
      await queryClient.invalidateQueries({ queryKey: ["all-tutors"] });
      setSelectedTutor(null);
      setRejectReason("");
    },
  });

  const tutors = activeTab === "pending" ? pendingQuery.data : allQuery.data;
  const isLoading = pendingQuery.isLoading || allQuery.isLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-indigo-500 animate-spin"
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Tutor Management
              </h1>
              <p className="text-slate-500 mt-1">
                Review and manage tutor applications
              </p>
            </div>
            <Link href="/admin" className="btn-secondary px-4 py-2 text-sm">
              Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 border border-slate-200 w-fit">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === "pending"
                ? "bg-indigo-500 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Pending
            {pendingQuery.data && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs bg-white/20">
                {pendingQuery.data.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === "all"
                ? "bg-indigo-500 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Tutors
          </button>
        </div>

        <div className="flex gap-6">
          {/* List */}
          <div className="flex-1 space-y-3">
            {tutors?.length === 0 ? (
              <div className="card p-12 text-center">
                <p className="text-slate-500 font-medium">No tutors found</p>
                <p className="text-slate-400 text-sm mt-1">
                  {activeTab === "pending"
                    ? "No pending applications"
                    : "No tutors registered yet"}
                </p>
              </div>
            ) : (
              tutors?.map((tutor) => (
                <div
                  key={tutor.userId}
                  onClick={() => setSelectedTutor(tutor)}
                  className={`card p-4 cursor-pointer ${
                    selectedTutor?.userId === tutor.userId
                      ? "ring-2 ring-indigo-400 border-indigo-300"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                        {tutor.user.firstName[0]}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {tutor.user.firstName} {tutor.user.lastName}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {tutor.specialization}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`badge text-xs font-semibold ${
                        tutor.status === "pending"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : tutor.status === "approved"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      {tutor.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Detail Panel */}
          {selectedTutor && (
            <div className="w-96 shrink-0">
              <div className="card p-6 sticky top-24 animate-scale-in">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                    {selectedTutor.user.firstName[0]}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {selectedTutor.user.firstName}{" "}
                      {selectedTutor.user.lastName}
                    </h2>
                    <span
                      className={`badge text-xs font-semibold mt-1 ${
                        selectedTutor.status === "pending"
                          ? "bg-amber-50 text-amber-700"
                          : selectedTutor.status === "approved"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                      }`}
                    >
                      {selectedTutor.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <Field label="Email">{selectedTutor.user.email}</Field>
                  <Field label="Specialization">
                    {selectedTutor.specialization}
                  </Field>
                  <Field label="Languages">
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {selectedTutor.languages.map((lang) => (
                        <span
                          key={lang}
                          className="badge bg-slate-100 text-slate-600"
                        >
                          {lang}
                        </span>
                      ))}
                    </div>
                  </Field>
                  <Field label="Hourly Rate">
                    <span className="text-lg font-bold text-indigo-600">
                      ${selectedTutor.hourlyRate.toFixed(2)}
                    </span>
                    <span className="text-slate-400 text-sm">/hr</span>
                  </Field>
                  <Field label="Bio">
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {selectedTutor.bio}
                    </p>
                  </Field>
                  {selectedTutor.documentUrl && (
                    <Field label="Document">
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
                        View Document
                      </a>
                    </Field>
                  )}
                </div>

                {selectedTutor.status === "pending" && (
                  <div className="mt-6 space-y-3 pt-6 border-t border-slate-100">
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
                          Approving...
                        </span>
                      ) : (
                        "Approve Application"
                      )}
                    </button>

                    <div className="relative">
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Enter rejection reason..."
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
                        className="btn-secondary w-full justify-center py-3 mt-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                      >
                        {rejectMutation.isPending
                          ? "Rejecting..."
                          : "Reject Application"}
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
                      Download PDF
                    </a>
                  </div>
                )}

                {selectedTutor.status !== "pending" && (
                  <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                    {selectedTutor.rejectionReason && (
                      <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                        <p className="text-xs font-medium text-red-500 mb-1">
                          Rejection Reason
                        </p>
                        <p className="text-sm text-red-700">
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
                      Download PDF
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
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
        {label}
      </p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}
