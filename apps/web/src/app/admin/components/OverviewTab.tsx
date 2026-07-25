"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";
import {
  AlertIcon,
  BookIcon,
  CreditCardIcon,
  LessonIcon,
  MoneyIcon,
  RefreshIcon,
  SettingsIcon,
  UserIcon,
} from "@/components/icons/Icons";

type AdminStats = {
  totalEarnings: number;
  totalStudents: number;
  pendingApplications: number;
  openReports: number;
  totalTutors: number;
  completedLessons: number;
};

type RecentActivity = {
  id: string;
  type: "lesson" | "user" | "payment" | "payout" | "course" | string;
  description: string;
  user: string;
  createdAt: string;
};

const activityVisuals = {
  lesson: {
    color: "#0f766e",
    bg: "rgba(15,118,110,.1)",
    Icon: LessonIcon,
  },
  user: { color: "#2563eb", bg: "rgba(37,99,235,.1)", Icon: UserIcon },
  payment: { color: "#16a34a", bg: "rgba(22,163,74,.1)", Icon: CreditCardIcon },
  payout: { color: "#ca8a04", bg: "rgba(202,138,4,.1)", Icon: MoneyIcon },
  course: { color: "#9333ea", bg: "rgba(147,51,234,.1)", Icon: BookIcon },
};

export default function OverviewTab() {
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const locale = lang === "ar" ? "ar-EG" : "en-US";

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => (await apiClient.get<AdminStats>("/admin/stats")).data,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const activityQuery = useQuery({
    queryKey: ["admin-recent-activity"],
    queryFn: async () =>
      (await apiClient.get<RecentActivity[]>("/admin/activity/recent")).data,
    staleTime: 20_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const stats = statsQuery.data;
  const statCards = [
    {
      label: t("إجمالي الأرباح", "Total Earnings"),
      value: stats?.totalEarnings ?? 0,
      prefix: "$",
      color: "#16a34a",
      Icon: MoneyIcon,
    },
    {
      label: t("الطلاب النشطون", "Active Students"),
      value: stats?.totalStudents ?? 0,
      color: "#D4A353",
      Icon: UserIcon,
    },
    {
      label: t("طلبات المعلمين المعلقة", "Pending Tutor Requests"),
      value: stats?.pendingApplications ?? 0,
      color: "#ca8a04",
      Icon: UserIcon,
    },
    {
      label: t("البلاغات المفتوحة", "Open Reports"),
      value: stats?.openReports ?? 0,
      color: "#dc2626",
      Icon: AlertIcon,
    },
  ];
  const quickActions = [
    {
      label: t("مراجعة طلبات المعلمين", "Review Tutor Requests"),
      tab: "tutors",
      Icon: UserIcon,
    },
    {
      label: t("إدارة الدورات", "Manage Courses"),
      tab: "courses",
      Icon: BookIcon,
    },
    {
      label: t("البلاغات الجديدة", "New Reports"),
      tab: "reports",
      Icon: AlertIcon,
    },
    {
      label: t("إعدادات المنصة", "Platform Settings"),
      tab: "settings",
      Icon: SettingsIcon,
    },
  ];

  return (
    <div className="space-y-6">
      {statsQuery.isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
          style={{
            borderColor: "rgba(239,68,68,.35)",
            background: "rgba(239,68,68,.06)",
          }}
        >
          <p className="text-sm font-semibold text-red-500">
            {t(
              "تعذر تحديث ملخص الإحصاءات.",
              "The statistics summary could not be updated.",
            )}
          </p>
          <button
            type="button"
            onClick={() => statsQuery.refetch()}
            className="btn-secondary min-h-10"
          >
            <RefreshIcon className="h-4 w-4" />
            {t("إعادة المحاولة", "Try again")}
          </button>
        </div>
      )}

      <section
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label={t("ملخص المنصة", "Platform summary")}
      >
        {statCards.map(({ label, value, prefix, color, Icon }) => (
          <article key={label} className="card-dark p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                {label}
              </span>
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ color, background: `${color}14` }}
              >
                <Icon />
              </span>
            </div>
            <p
              className="text-3xl font-bold"
              dir={prefix ? "ltr" : undefined}
              style={{ color }}
            >
              {statsQuery.isLoading ? (
                <span className="inline-block h-8 w-16 rounded skeleton" />
              ) : (
                <>
                  {prefix}
                  {value.toLocaleString(locale)}
                </>
              )}
            </p>
          </article>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section
          className="card p-5 sm:p-6"
          aria-labelledby="quick-actions-title"
        >
          <h3
            id="quick-actions-title"
            className="text-lg font-bold"
            style={{ color: "var(--text-main)" }}
          >
            {t("إجراءات سريعة", "Quick Actions")}
          </h3>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {t(
              "انتقل مباشرة إلى مهام الإدارة المتكررة.",
              "Go directly to common administrative tasks.",
            )}
          </p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {quickActions.map(({ label, tab, Icon }) => (
              <button
                key={tab}
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("admin-navigate", { detail: { tab } }),
                  )
                }
                className="btn-secondary min-h-11 justify-start px-4 text-start text-sm"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </section>

        <section
          className="card overflow-hidden"
          aria-labelledby="recent-activity-title"
        >
          <header
            className="flex flex-wrap items-start justify-between gap-3 border-b p-5 sm:p-6"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div>
              <h3
                id="recent-activity-title"
                className="text-lg font-bold"
                style={{ color: "var(--text-main)" }}
              >
                {t("أحدث النشاطات", "Recent Activity")}
              </h3>
              <p
                className="mt-1 text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                {activityQuery.dataUpdatedAt > 0
                  ? t(
                      `آخر تحديث ${new Date(activityQuery.dataUpdatedAt).toLocaleString(locale)}`,
                      `Updated ${new Date(activityQuery.dataUpdatedAt).toLocaleString(locale)}`,
                    )
                  : t("يتم التحديث كل 30 ثانية", "Refreshes every 30 seconds")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => activityQuery.refetch()}
              disabled={activityQuery.isFetching}
              className="btn-ghost min-h-10 min-w-10 p-2"
              aria-label={t("تحديث النشاطات", "Refresh activity")}
              title={t("تحديث النشاطات", "Refresh activity")}
            >
              <RefreshIcon
                className={`h-5 w-5 ${activityQuery.isFetching ? "animate-spin" : ""}`}
              />
            </button>
          </header>
          <div className="p-5 sm:p-6">
            {activityQuery.isLoading ? (
              <div
                className="space-y-4"
                aria-label={t("جاري تحميل النشاطات", "Loading activity")}
              >
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-lg skeleton" />
                    <div className="flex-1">
                      <div className="mb-2 h-4 w-3/4 rounded skeleton" />
                      <div className="h-3 w-1/2 rounded skeleton" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activityQuery.isError ? (
              <div role="alert" className="py-6 text-center">
                <p className="text-sm font-semibold text-red-500">
                  {t(
                    "تعذر تحميل أحدث النشاطات.",
                    "Recent activity could not be loaded.",
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => activityQuery.refetch()}
                  className="btn-secondary mt-4 min-h-10"
                >
                  <RefreshIcon className="h-4 w-4" />
                  {t("إعادة المحاولة", "Try again")}
                </button>
              </div>
            ) : activityQuery.data?.length === 0 ? (
              <div className="py-8 text-center">
                <p
                  className="font-semibold"
                  style={{ color: "var(--text-main)" }}
                >
                  {t("لا توجد نشاطات حديثة", "No recent activity")}
                </p>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t(
                    "ستظهر أحداث الدروس والحسابات والمدفوعات والدورات هنا.",
                    "Lesson, account, payment, payout, and course events will appear here.",
                  )}
                </p>
              </div>
            ) : (
              <ol className="space-y-1">
                {activityQuery.data?.slice(0, 8).map((activity) => {
                  const visual =
                    activityVisuals[
                      activity.type as keyof typeof activityVisuals
                    ] ?? activityVisuals.lesson;
                  return (
                    <li
                      key={`${activity.type}-${activity.id}`}
                      className="flex items-start gap-3 border-b py-3 last:border-0"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ color: visual.color, background: visual.bg }}
                      >
                        <visual.Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p
                          className="text-sm font-semibold"
                          style={{ color: "var(--text-main)" }}
                        >
                          {activity.description}
                        </p>
                        <p
                          className="mt-1 text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {activity.user} ·{" "}
                          {new Date(activity.createdAt).toLocaleString(locale)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
