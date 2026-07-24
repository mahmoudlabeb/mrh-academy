"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import nextDynamic from "next/dynamic";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { useLanguage } from "@/contexts/language-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
const DashboardPaneSkeleton = () => (
  <div className="dashboard-pane-skeleton" aria-hidden="true">
    <span />
    <span />
    <span />
  </div>
);

const MessagesView = nextDynamic(() => import("./components/MessagesView"), {
  loading: DashboardPaneSkeleton,
});
const StudentsList = nextDynamic(() => import("./components/StudentsList"), {
  loading: DashboardPaneSkeleton,
});
const Insights = nextDynamic(() => import("./components/Insights"), {
  loading: DashboardPaneSkeleton,
});
const SettingsView = nextDynamic(() => import("./components/SettingsView"), {
  loading: DashboardPaneSkeleton,
});
const NotificationsPanel = nextDynamic(
  () => import("@/app/student/components/NotificationsPanel"),
  { loading: DashboardPaneSkeleton },
);
const CourseStudio = nextDynamic(() => import("./components/CourseStudio"), {
  loading: DashboardPaneSkeleton,
});

type TutorStats = {
  completedLessons: number;
  totalHoursTaught: number;
  totalEarnings: number;
  reviewCount: number;
  averageRating: number;
  studentCount: number;
};

type TutorLesson = {
  id: string;
  status: string;
  scheduledTime: string;
  durationMinutes: number;
  price: number;
  meetUrl?: string;
  student?: { firstName?: string; lastName?: string };
};

type PaginatedLessons = {
  data: TutorLesson[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type DashboardSection =
  | "dashboard"
  | "messages"
  | "calendar"
  | "students"
  | "classroom"
  | "insights"
  | "profile"
  | "settings";

const SIDEBAR_ITEMS: {
  key: DashboardSection;
  labelAr: string;
  labelEn: string;
}[] = [
  { key: "dashboard", labelAr: "لوحة التحكم", labelEn: "Dashboard" },
  { key: "messages", labelAr: "الرسائل", labelEn: "Messages" },
  { key: "calendar", labelAr: "التقويم", labelEn: "Calendar" },
  { key: "students", labelAr: "الطلاب", labelEn: "Students" },
  { key: "classroom", labelAr: "الفصل الدراسي", labelEn: "Classroom" },
  { key: "insights", labelAr: "التحليلات", labelEn: "Insights" },
  { key: "profile", labelAr: "الملف الشخصي", labelEn: "Public Profile" },
  { key: "settings", labelAr: "الإعدادات", labelEn: "Settings" },
];

function SidebarIcon({ section }: { section: DashboardSection }) {
  const icons: Record<DashboardSection, React.JSX.Element> = {
    dashboard: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
        />
      </svg>
    ),
    messages: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
        />
      </svg>
    ),
    calendar: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
        />
      </svg>
    ),
    students: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        />
      </svg>
    ),
    classroom: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 10.5l4.5-4.5v12L15 13.5M3 6.75A2.25 2.25 0 015.25 4.5h7.5A2.25 2.25 0 0115 6.75v10.5A2.25 2.25 0 0112.75 19.5h-7.5A2.25 2.25 0 013 17.25V6.75z"
        />
      </svg>
    ),
    insights: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
        />
      </svg>
    ),
    profile: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
        />
      </svg>
    ),
    settings: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  };
  return icons[section];
}

export const dynamic = "force-dynamic";

export default function TutorPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "var(--bg-main)" }}
        >
          Loading...
        </div>
      }
    >
      <TutorPageContent />
    </Suspense>
  );
}

function TutorPageContent() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLanguage } = useLanguage();
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] =
    useState<DashboardSection>("dashboard");
  const [messageWithUserId, setMessageWithUserId] = useState<string | null>(
    null,
  );
  const [profileOpen, setProfileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const { data: notifData } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: async () => {
      const { data } = await apiClient.get("/notifications?unread=true");
      return { count: Array.isArray(data) ? data.length : (data?.count ?? 0) };
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const tab = searchParams.get("tab");
    const withUser = searchParams.get("with");
    if (tab && SIDEBAR_ITEMS.some((i) => i.key === tab)) {
      setActiveSection(tab as DashboardSection);
    }
    if (withUser) {
      setMessageWithUserId(withUser);
    }
  }, [searchParams]);

  const isAr = lang === "ar";

  const profileQuery = useQuery({
    queryKey: ["tutor-profile-status"],
    queryFn: async () =>
      (
        await apiClient.get<{ status: string; rejectionReason?: string }>(
          "/tutors/me/profile",
        )
      ).data,
    retry: false,
  });
  const isApprovedTutor = profileQuery.data?.status === "approved";

  const statsQuery = useQuery({
    queryKey: ["tutor-stats"],
    queryFn: async () => {
      const { data } = await apiClient.get<TutorStats>("/tutors/me/stats");
      return data;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: isApprovedTutor,
  });

  const stats = statsQuery.data;

  const coursesQuery = useQuery({
    queryKey: ["my-courses"],
    queryFn: async () =>
      (
        await apiClient.get<
          { id: string; title: string; price: number; referralCode: string }[]
        >("/courses/my/courses")
      ).data,
    staleTime: 30_000,
    enabled: isApprovedTutor && activeSection === "dashboard",
  });
  const referralStatsQuery = useQuery({
    queryKey: ["tutor-referral-stats"],
    queryFn: async () =>
      (
        await apiClient.get<{
          tutor: {
            sales: number;
            tutorEarnings: number;
            academyEarnings: number;
          };
          academy: {
            sales: number;
            tutorEarnings: number;
            academyEarnings: number;
          };
        }>("/courses/my/referral-stats")
      ).data,
    staleTime: 30_000,
    enabled: isApprovedTutor && activeSection === "dashboard",
  });

  const allLessonsQuery = useQuery({
    queryKey: ["tutor-all-lessons"],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedLessons>("/lessons");
      return data.data ?? [];
    },
    staleTime: 30_000,
    enabled: isApprovedTutor && activeSection === "dashboard",
  });

  const pendingLessons = useMemo(
    () =>
      (allLessonsQuery.data ?? []).filter(
        (lesson) => lesson.status === "pending",
      ),
    [allLessonsQuery.data],
  );
  const recentLessons = useMemo(
    () =>
      (allLessonsQuery.data ?? [])
        .filter((lesson) => lesson.status !== "pending")
        .slice(0, 5),
    [allLessonsQuery.data],
  );

  const approveLessonMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await apiClient.post(`/lessons/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutor-all-lessons"] });
      queryClient.invalidateQueries({ queryKey: ["tutor-active-lessons"] });
    },
  });

  const rejectLessonMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      await apiClient.post(`/lessons/${lessonId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutor-all-lessons"] });
    },
  });

  const activeLessonsQuery = useQuery({
    queryKey: ["tutor-active-lessons"],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedLessons>("/lessons");
      return (data.data ?? []).filter(
        (l) => l.status === "confirmed" && l.meetUrl,
      );
    },
    staleTime: 30_000,
    enabled: isApprovedTutor && activeSection === "classroom",
  });

  const [cancellingLessonId, setCancellingLessonId] = useState<string | null>(
    null,
  );
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyReferralLink = (courseId: string, referralCode: string) => {
    const link = `${window.location.origin}/courses/${courseId}?ref=${encodeURIComponent(referralCode)}`;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopiedId(courseId);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch(() => {});
  };

  const connectQuery = useQuery({
    queryKey: ["stripe-connect-status"],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        connected: boolean;
        onboardingComplete: boolean;
        stripeAccountId: string | null;
      }>("/stripe/connect/status");
      return data;
    },
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    enabled: isApprovedTutor && activeSection === "dashboard",
  });

  const [connectError, setConnectError] = useState("");
  const [connectPending, setConnectPending] = useState(false);

  const handleConnectStripe = async () => {
    setConnectError("");
    setConnectPending(true);
    try {
      const { data } = await apiClient.post<{ url: string }>(
        "/stripe/connect/onboarding",
      );
      window.open(data.url, "_blank");
    } catch {
      setConnectError(
        t(
          "تعذر بدء ربط Stripe. تأكد من إعداد Stripe في الخادم ثم حاول مرة أخرى.",
          "Stripe onboarding could not start. Check the server Stripe configuration and try again.",
        ),
      );
    } finally {
      setConnectPending(false);
    }
  };

  const t = (ar: string, en: string) => (isAr ? ar : en);

  const cancelLessonMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      await apiClient.post(`/lessons/${lessonId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutor-active-lessons"] });
      queryClient.invalidateQueries({ queryKey: ["tutor-recent-lessons"] });
      alert(
        t(
          "تم إلغاء الدرس واسترداد المبلغ للطالب.",
          "Lesson cancelled. The student has been refunded.",
        ),
      );
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ?? t("تعذر إلغاء الدرس", "Failed to cancel lesson");
      alert(message);
    },
    onSettled: () => setCancellingLessonId(null),
  });

  const handleCancelLesson = (lesson: {
    id: string;
    student?: { firstName?: string; lastName?: string };
  }) => {
    const studentName = lesson.student
      ? `${lesson.student.firstName ?? ""} ${lesson.student.lastName ?? ""}`.trim()
      : t("الطالب", "the student");
    const confirmed = window.confirm(
      t(
        `هل تريد إلغاء الدرس مع ${studentName}؟ سيتم استرداد المبلغ للطالب.`,
        `Cancel the lesson with ${studentName}? The student will receive a full refund.`,
      ),
    );
    if (!confirmed) return;
    setCancellingLessonId(lesson.id);
    cancelLessonMutation.mutate(lesson.id);
  };

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return (
          <div className="space-y-8">
            <div>
              <h2
                className="text-2xl font-bold"
                style={{ color: "var(--text-main)" }}
              >
                {t("نظرة عامة", "Overview")}
              </h2>
              <p
                className="text-sm mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                {t(
                  "مرحبًا بعودتك! إليك ملخص أدائك.",
                  "Welcome back! Here is your performance summary.",
                )}
              </p>
            </div>

            <CourseStudio />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card-dark p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(212, 163, 83,0.12)" }}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      style={{ color: "var(--primary-color)" }}
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t("الأرباح", "Earnings")}
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "#22c55e" }}>
                  {statsQuery.isLoading ? (
                    <span className="inline-block w-16 h-8 skeleton rounded" />
                  ) : (
                    `$${(stats?.totalEarnings ?? 0).toFixed(2)}`
                  )}
                </p>
              </div>

              <div className="card-dark p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(212, 163, 83,0.12)" }}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      style={{ color: "var(--primary-color)" }}
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t("ساعات التدريس", "Hours Taught")}
                  </span>
                </div>
                <p
                  className="text-2xl font-bold"
                  style={{ color: "var(--text-main)" }}
                >
                  {statsQuery.isLoading ? (
                    <span className="inline-block w-12 h-8 skeleton rounded" />
                  ) : (
                    `${stats?.totalHoursTaught ?? 0}`
                  )}
                </p>
              </div>

              <div className="card-dark p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(212, 163, 83,0.12)" }}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      style={{ color: "var(--primary-color)" }}
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                      />
                    </svg>
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t("التقييم", "Rating")}
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "#eab308" }}>
                  {statsQuery.isLoading ? (
                    <span className="inline-block w-12 h-8 skeleton rounded" />
                  ) : stats?.averageRating ? (
                    `${stats.averageRating.toFixed(1)} ★`
                  ) : (
                    "—"
                  )}
                </p>
              </div>

              <div className="card-dark p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(212, 163, 83,0.12)" }}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      style={{ color: "var(--primary-color)" }}
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                      />
                    </svg>
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t("الطلاب", "Students")}
                  </span>
                </div>
                <p
                  className="text-2xl font-bold"
                  style={{ color: "var(--text-main)" }}
                >
                  {statsQuery.isLoading ? (
                    <span className="inline-block w-12 h-8 skeleton rounded" />
                  ) : (
                    `${stats?.studentCount ?? 0}`
                  )}
                </p>
              </div>
            </div>

            {/* Earnings & Payouts quick link */}
            <Link
              href="/tutor/earnings"
              className="card-gold p-5 flex items-center justify-between group transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(212,163,83,0.15)" }}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="#D4A353"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p
                    className="font-semibold"
                    style={{ color: "var(--text-main)" }}
                  >
                    {t("الأرباح والسحب", "Earnings & Payouts")}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t(
                      "اطلع على رصيدك واطلب سحب أرباحك",
                      "View balance and request payouts",
                    )}
                  </p>
                </div>
              </div>
              <svg
                className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                style={{ color: "#D4A353" }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>

            <div className="card-dark p-6">
              <h3
                className="text-lg font-bold mb-4"
                style={{ color: "var(--text-main)" }}
              >
                {t("الحساب البنكي (Stripe Connect)", "Stripe Connect Payouts")}
              </h3>
              {connectQuery.isLoading ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {t("جاري التحميل...", "Loading...")}
                </p>
              ) : connectQuery.data?.onboardingComplete ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500" />
                    <span
                      className="text-sm font-semibold"
                      style={{ color: "#22c55e" }}
                    >
                      {t("متصل ومفعل", "Connected & Active")}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {t(
                      "يمكنك استلام المدفوعات مباشرة إلى حسابك البنكي.",
                      "You can receive payouts directly to your bank account.",
                    )}
                  </p>
                </div>
              ) : connectQuery.data?.connected ? (
                <div className="space-y-3">
                  <p className="text-sm" style={{ color: "#eab308" }}>
                    {t(
                      "الحساب متصل لكن لم يكتمل التسجيل",
                      "Account connected but onboarding not complete",
                    )}
                  </p>
                  <button
                    onClick={handleConnectStripe}
                    disabled={connectPending}
                    className="btn-primary text-sm"
                  >
                    {t("أكمل التسجيل", "Complete Onboarding")}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {t(
                      "قم بتوصيل حساب Stripe لاستلام المدفوعات مباشرة.",
                      "Connect your Stripe account to receive direct payouts.",
                    )}
                  </p>
                  <button
                    onClick={handleConnectStripe}
                    disabled={connectPending}
                    className="btn-primary text-sm"
                  >
                    {t("ربط Stripe", "Connect Stripe")}
                  </button>
                </div>
              )}
              {connectError && (
                <p className="mt-3 text-xs text-red-400" role="alert">
                  {connectError}
                </p>
              )}
            </div>

            {pendingLessons.length > 0 && (
              <div className="card-dark p-6">
                <h3
                  className="text-lg font-bold mb-4"
                  style={{ color: "var(--text-main)" }}
                >
                  {t("طلبات دروس جديدة", "New Lesson Requests")}
                </h3>
                <div className="space-y-3">
                  {pendingLessons.map((lesson) => {
                    return (
                      <div
                        key={lesson.id}
                        className="p-4 rounded-xl"
                        style={{
                          background: "var(--bg-main)",
                          border: "1px solid var(--border-color)",
                        }}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                              style={{
                                background: "rgba(212, 163, 83,0.12)",
                                color: "var(--primary-color)",
                              }}
                            >
                              {lesson.student?.firstName?.[0] ?? "S"}
                            </div>
                            <div>
                              <p
                                className="text-sm font-semibold"
                                style={{ color: "var(--text-main)" }}
                              >
                                {lesson.student
                                  ? `${lesson.student.firstName ?? ""} ${lesson.student.lastName ?? ""}`.trim()
                                  : t("طالب", "Student")}
                              </p>
                              <p
                                className="text-xs"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {new Date(
                                  lesson.scheduledTime,
                                ).toLocaleDateString()}{" "}
                                &middot; {lesson.durationMinutes}{" "}
                                {t("دقيقة", "min")} &middot; $
                                {lesson.price.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <div className="flex items-center gap-2 shrink-0 mt-5">
                            <button
                              onClick={() =>
                                rejectLessonMutation.mutate(lesson.id)
                              }
                              disabled={rejectLessonMutation.isPending}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                              style={{
                                background: "rgba(239,68,68,0.1)",
                                color: "#ef4444",
                                border: "1px solid rgba(239,68,68,0.3)",
                              }}
                            >
                              {t("رفض", "Decline")}
                            </button>
                            <button
                              onClick={() => {
                                approveLessonMutation.mutate({ id: lesson.id });
                              }}
                              disabled={approveLessonMutation.isPending}
                              className="btn-primary px-4 py-1.5 text-xs"
                            >
                              {t("موافقة", "Approve")}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {coursesQuery.data && coursesQuery.data.length > 0 && (
              <div className="card-dark p-6">
                <h3
                  className="text-lg font-bold mb-4"
                  style={{ color: "var(--text-main)" }}
                >
                  {t("روابط الإحالة", "Referral Links")}
                </h3>
                {referralStatsQuery.data && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div
                      className="rounded-xl p-3"
                      style={{
                        background: "var(--bg-main)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {t("مبيعات رابطك", "Referral sales")}
                      </p>
                      <p
                        className="text-xl font-bold mt-1"
                        style={{ color: "var(--text-main)" }}
                      >
                        {referralStatsQuery.data.tutor.sales}
                      </p>
                      <p
                        className="text-[11px]"
                        style={{ color: "var(--primary-color)" }}
                      >
                        98% {t("للمعلم", "to tutor")}
                      </p>
                    </div>
                    <div
                      className="rounded-xl p-3"
                      style={{
                        background: "var(--bg-main)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {t("مبيعات الأكاديمية", "Academy sales")}
                      </p>
                      <p
                        className="text-xl font-bold mt-1"
                        style={{ color: "var(--text-main)" }}
                      >
                        {referralStatsQuery.data.academy.sales}
                      </p>
                      <p
                        className="text-[11px]"
                        style={{ color: "var(--primary-color)" }}
                      >
                        47% {t("للمعلم", "to tutor")}
                      </p>
                    </div>
                  </div>
                )}
                <p
                  className="text-sm mb-4"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t(
                    "شارك هذه الروابط مع طلابك. عندما يشترك طالب عبر رابطك، تحصل على عمولة 98% من سعر الكورس.",
                    "Share these links with your students. When a student enrolls via your link, you earn 98% of the course price.",
                  )}
                </p>
                <div className="space-y-3">
                  {coursesQuery.data.map((course) => (
                    <div
                      key={course.id}
                      className="flex items-center justify-between p-3 rounded-xl"
                      style={{
                        background: "var(--bg-main)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm font-semibold truncate"
                          style={{ color: "var(--text-main)" }}
                        >
                          {course.title}
                        </p>
                        <p
                          className="text-[11px] mt-1 truncate"
                          style={{ color: "var(--primary-color)" }}
                        >
                          {t("كود البيع", "Selling code")}:{" "}
                          {course.referralCode}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {t("السعر", "Price")}: ${course.price.toFixed(2)}{" "}
                          &middot; {t("عمولتك", "Your cut")}: $
                          {(course.price * 0.98).toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          copyReferralLink(course.id, course.referralCode)
                        }
                        className="btn-ghost px-3 py-1.5 text-sm shrink-0"
                      >
                        {copiedId === course.id ? (
                          <span
                            className="flex items-center gap-1"
                            style={{ color: "#22c55e" }}
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4.5 12.75l6 6 9-13.5"
                              />
                            </svg>
                            {t("تم النسخ", "Copied")}
                          </span>
                        ) : (
                          <span
                            className="flex items-center gap-1"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                              />
                            </svg>
                            {t("نسخ الرابط", "Copy Link")}
                          </span>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card-dark p-6">
              <h3
                className="text-lg font-bold mb-4"
                style={{ color: "var(--text-main)" }}
              >
                {t("النشاط الأخير", "Recent Activity")}
              </h3>
              <div className="space-y-4">
                {allLessonsQuery.isLoading ? (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {t("جاري التحميل...", "Loading...")}
                  </p>
                ) : recentLessons.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {t("لا يوجد نشاط حديث", "No recent activity")}
                  </p>
                ) : (
                  recentLessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="flex items-center gap-4 py-3 border-b"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{
                          background: "rgba(212, 163, 83,0.12)",
                          color: "var(--primary-color)",
                        }}
                      >
                        {lesson.student?.firstName?.[0] ?? "S"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-semibold"
                          style={{ color: "var(--text-main)" }}
                        >
                          {lesson.student
                            ? `${lesson.student.firstName ?? ""} ${lesson.student.lastName ?? ""}`.trim()
                            : t("طالب", "Student")}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {new Date(lesson.scheduledTime).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className="badge text-xs"
                        style={{
                          background: "rgba(34,197,94,0.1)",
                          color: "#22c55e",
                        }}
                      >
                        {lesson.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      case "messages":
        return <MessagesView initialSelectedUserId={messageWithUserId} />;
      case "calendar":
        return (
          <div className="card-dark p-8 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(212, 163, 83,0.1)" }}
            >
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                style={{ color: "var(--primary-color)" }}
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                />
              </svg>
            </div>
            <h3
              className="text-xl font-bold mb-2"
              style={{ color: "var(--text-main)" }}
            >
              {t("إدارة المواعيد", "Manage Availability")}
            </h3>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              {t(
                "حدد أوقات التدريس باستخدام التقويم.",
                "Set your teaching hours using the calendar.",
              )}
            </p>
            <Link href="/tutor/availability" className="btn-primary">
              {t("فتح التقويم", "Open Calendar")}
            </Link>
          </div>
        );
      case "students":
        return <StudentsList />;
      case "classroom":
        return (
          <div className="space-y-4">
            <div>
              <h2
                className="text-2xl font-bold"
                style={{ color: "var(--text-main)" }}
              >
                {t("الفصل الدراسي", "Classroom")}
              </h2>
              <p
                className="text-sm mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                {t(
                  "الدروس المؤكدة الجاهزة للدخول.",
                  "Confirmed lessons ready to join.",
                )}
              </p>
            </div>
            {activeLessonsQuery.isLoading ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {t("جاري التحميل...", "Loading...")}
              </p>
            ) : (activeLessonsQuery.data ?? []).length === 0 ? (
              <div className="card-dark p-8 text-center">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {t("لا توجد دروس نشطة", "No active lessons")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeLessonsQuery.data?.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="card-dark p-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p
                        className="font-semibold"
                        style={{ color: "var(--text-main)" }}
                      >
                        {lesson.student
                          ? `${lesson.student.firstName ?? ""} ${lesson.student.lastName ?? ""}`.trim()
                          : t("طالب", "Student")}
                      </p>
                      <p
                        className="text-xs mt-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {new Date(lesson.scheduledTime).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCancelLesson(lesson)}
                        disabled={cancellingLessonId === lesson.id}
                        className="text-sm px-3 py-2 rounded-lg border transition-colors disabled:opacity-50"
                        style={{
                          borderColor: "rgba(239,68,68,0.3)",
                          color: "#ef4444",
                        }}
                      >
                        {cancellingLessonId === lesson.id
                          ? t("جاري الإلغاء...", "Cancelling...")
                          : t("إلغاء", "Cancel")}
                      </button>
                      <Link
                        href={`/classroom/${lesson.meetUrl}`}
                        className="btn-primary text-sm px-4 py-2"
                      >
                        {t("دخول الفصل", "Enter Classroom")}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case "insights":
        return <Insights />;
      case "profile":
        return (
          <div className="card-dark p-8 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(212, 163, 83,0.1)" }}
            >
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                style={{ color: "var(--primary-color)" }}
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
            </div>
            <h3
              className="text-xl font-bold mb-2"
              style={{ color: "var(--text-main)" }}
            >
              {t("الملف الشخصي", "Public Profile")}
            </h3>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              {t(
                "عرض وتحرير ملفك الشخصي العام.",
                "View and edit your public profile.",
              )}
            </p>
            <Link href="/tutor/profile" className="btn-primary">
              {t("تعديل الملف", "Edit Profile")}
            </Link>
          </div>
        );
      case "settings":
        return <SettingsView />;
    }
  };

  if (profileQuery.isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-main)", color: "var(--text-main)" }}
      >
        {t("جاري التحقق من حالة الحساب...", "Checking account status...")}
      </div>
    );
  }

  if (!isApprovedTutor) {
    const rejected = profileQuery.data?.status === "rejected";
    return (
      <main
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: "var(--bg-main)" }}
      >
        <section
          className="card-dark max-w-lg w-full p-8 text-center"
          aria-labelledby="tutor-status-title"
        >
          <div
            className="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center text-2xl"
            style={{ background: "rgba(212,163,83,0.15)", color: "#D4A353" }}
            aria-hidden="true"
          >
            {rejected ? "!" : "…"}
          </div>
          <h1
            id="tutor-status-title"
            className="text-2xl font-bold mb-3"
            style={{ color: "var(--text-main)" }}
          >
            {rejected
              ? t(
                  "لم تتم الموافقة على حساب المعلم",
                  "Tutor account not approved",
                )
              : t("حساب المعلم قيد المراجعة", "Tutor account under review")}
          </h1>
          <p className="mb-6" style={{ color: "var(--text-muted)" }}>
            {rejected
              ? profileQuery.data?.rejectionReason ||
                t(
                  "راجع بيانات ملفك أو تواصل مع الدعم قبل إعادة التقديم.",
                  "Review your profile or contact support before applying again.",
                )
              : t(
                  "سنُعلمك عند انتهاء فريق الإدارة من مراجعة طلبك. لن تتوفر أدوات التدريس حتى تتم الموافقة.",
                  "We will notify you when the admin review is complete. Teaching tools remain unavailable until approval.",
                )}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/tutor/profile" className="btn-secondary">
              {t("مراجعة الملف الشخصي", "Review profile")}
            </Link>
            <button type="button" onClick={logout} className="btn-primary">
              {t("تسجيل الخروج", "Log out")}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div
      className="tutor-dashboard min-h-screen flex flex-col"
      style={{ background: "var(--bg-main)" }}
    >
      {/* Top Navigation Bar */}
      <header className="dashboard-header tutor-dashboard-header sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 md:px-6 py-2">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-lg font-bold logo-font"
              style={{ color: "#D4A353" }}
            >
              Mr.H Academy
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {SIDEBAR_ITEMS.map((item) => {
                const active = activeSection === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveSection(item.key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: active
                        ? "rgba(212, 163, 83,0.12)"
                        : "transparent",
                      color: active ? "#D4A353" : "#E4CC9C",
                    }}
                  >
                    <SidebarIcon section={item.key} />
                    <span>{isAr ? item.labelAr : item.labelEn}</span>
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: "rgba(212, 163, 83,0.1)" }}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="#22c55e"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span
                className="text-sm font-semibold"
                style={{ color: "#22c55e" }}
              >
                {statsQuery.isLoading
                  ? "..."
                  : `$${(stats?.totalEarnings ?? 0).toFixed(2)}`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/tutor/availability?mode=timeoff";
                }}
                className="btn-ghost tutor-timeoff text-sm px-3 py-2 rounded-xl"
                style={{ color: "#FFFFF0" }}
              >
                <svg
                  className="w-4 h-4 inline ms-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                  />
                </svg>
                {t("خطط لإجازة", "Plan Time Off")}
              </button>

              {/* Notification Bell */}
              <button
                type="button"
                onClick={() => setShowNotifications(true)}
                className="relative p-2 rounded-xl hover:bg-white/5 transition-colors"
                title={t("الإشعارات", "Notifications")}
                style={{ color: "#FFFFF0" }}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
                {(notifData?.count ?? 0) > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 w-4.5 h-4.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {(notifData?.count ?? 0) > 9 ? "9+" : notifData?.count}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveSection("students")}
                className="btn-primary tutor-schedule text-sm px-4 py-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                {t("احجز درسًا لطالب", "Schedule Lesson")}
              </button>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                aria-label={
                  theme === "dark"
                    ? t("التبديل إلى الوضع الفاتح", "Switch to light mode")
                    : t("التبديل إلى الوضع الداكن", "Switch to dark mode")
                }
                title={
                  theme === "dark"
                    ? t("التبديل إلى الوضع الفاتح", "Switch to light mode")
                    : t("التبديل إلى الوضع الداكن", "Switch to dark mode")
                }
                className="p-2 rounded-xl transition-colors tutor-theme-toggle"
                style={{ color: "#FFFFF0" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#1D535B")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {theme === "dark" ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  </svg>
                )}
              </button>

              {/* Language Toggle */}
              <button
                onClick={toggleLanguage}
                className="px-2 py-1 rounded-xl text-sm font-bold transition-colors tutor-language-toggle"
                style={{ color: "#D4A353" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#1D535B")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {isAr ? "EN" : "ع"}
              </button>

              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-xl transition-colors tutor-profile-trigger"
                  style={{ color: "#FFFFF0" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#1D535B")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{
                      background: "rgba(212, 163, 83,0.2)",
                      color: "#D4A353",
                    }}
                  >
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </div>
                  <svg
                    className={`w-4 h-4 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                </button>
                {profileOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setProfileOpen(false)}
                    />
                    <div
                      className="absolute start-0 mt-2 w-56 rounded-xl shadow-lg z-20 animate-scale-in overflow-hidden"
                      style={{
                        background: "var(--bg-light)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div
                        className="px-4 py-3 border-b"
                        style={{ borderColor: "var(--border-color)" }}
                      >
                        <p
                          className="text-sm font-semibold"
                          style={{ color: "var(--text-main)" }}
                        >
                          {user?.firstName} {user?.lastName}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {user?.email}
                        </p>
                      </div>
                      <div className="py-1">
                        <Link
                          href="/tutor/profile"
                          className="block w-full text-end px-4 py-2 text-sm transition-colors"
                          style={{ color: "var(--text-main)" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background =
                              "rgba(212, 163, 83,0.08)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          {t("الملف الشخصي", "Profile")}
                        </Link>
                        <button
                          onClick={() => {
                            logout();
                            setProfileOpen(false);
                          }}
                          className="w-full text-end px-4 py-2 text-sm transition-colors"
                          style={{ color: "#ef4444" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background =
                              "rgba(239,68,68,0.08)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          {t("تسجيل الخروج", "Logout")}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav
        className="tutor-mobile-nav md:hidden flex gap-1 px-4 py-2 overflow-x-auto"
        style={{ background: "#0F3A40", borderBottom: "1px solid #1D535B" }}
      >
        {SIDEBAR_ITEMS.map((item) => {
          const active = activeSection === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: active ? "rgba(212, 163, 83,0.12)" : "transparent",
                color: active ? "#D4A353" : "#E4CC9C",
              }}
            >
              <SidebarIcon section={item.key} />
              <span>{isAr ? item.labelAr : item.labelEn}</span>
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <main className="tutor-dashboard-main flex-1 p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto animate-fade-in" key={activeSection}>
          {renderContent()}
        </div>
      </main>

      {/* Notification Panel Overlay */}
      {showNotifications && (
        <NotificationsPanel onClose={() => setShowNotifications(false)} />
      )}
    </div>
  );
}
