"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import { FocusDecisionStrip } from "@/components/shared/FocusDecisionStrip";
import { DirectionalArrow } from "@/components/shared/DirectionalArrow";

type AdminStats = {
  pendingApplications: number;
  openReports: number;
};

type QueueItem = {
  label: string;
  detail: string;
  href: string;
};

export default function OperationsQueuePage() {
  const { user, isLoading: authLoading } = useAuth();
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const permissions = new Set(user?.assignedPermissions ?? []);
  const isFullAdmin = user?.role === "admin";
  const canManageTutors = isFullAdmin || permissions.has("manage_tutors");
  const canManageStudents = isFullAdmin || permissions.has("manage_students");
  const stats = useQuery({
    queryKey: ["ops-queue-stats"],
    queryFn: async () => (await apiClient.get<AdminStats>("/admin/stats")).data,
    enabled: isFullAdmin,
  });
  const pendingTutors = useQuery({
    queryKey: ["ops-pending-tutors"],
    queryFn: async () =>
      (await apiClient.get<unknown[]>("/admin/tutors/pending")).data,
    enabled: Boolean(user && canManageTutors && !isFullAdmin),
  });

  if (authLoading)
    return (
      <main className="focus-page" aria-busy="true">
        <div className="focus-skeleton" />
      </main>
    );
  if (!user || (user.role !== "admin" && user.role !== "subadmin")) {
    return (
      <main className="focus-page focus-empty">
        <h1>
          {isAr ? "غير مصرح لك بعرض العمليات" : "You cannot access operations"}
        </h1>
      </main>
    );
  }

  const queue: QueueItem[] = [];
  const pendingTutorCount = isFullAdmin
    ? (stats.data?.pendingApplications ?? 0)
    : (pendingTutors.data?.length ?? 0);
  if (canManageTutors && pendingTutorCount) {
    queue.push({
      label: isAr ? "طلبات معلّمين" : "Tutor applications",
      detail: isAr
        ? `${pendingTutorCount} بانتظار المراجعة`
        : `${pendingTutorCount} awaiting review`,
      href: "/admin?tab=tutors",
    });
  }
  if (isFullAdmin && stats.data?.openReports) {
    queue.push({
      label: isAr ? "بلاغات جديدة" : "Open reports",
      detail: isAr
        ? `${stats.data.openReports} تحتاج إلى مراجعة`
        : `${stats.data.openReports} need review`,
      href: "/admin?tab=reports",
    });
  }
  const queueLoading = stats.isLoading || pendingTutors.isLoading;
  const visibleScopeCount =
    Number(canManageTutors) + Number(canManageStudents) + Number(isFullAdmin);
  const nextQueueItem = queue[0];

  return (
    <main className="focus-page">
      <header className="focus-page-header">
        <div>
          <p className="focus-eyebrow">
            {isAr ? "مساحة العمليات" : "Operations workspace"}
          </p>
          <h1>{isAr ? "قائمة الانتظار" : "Queue"}</h1>
        </div>
        <span className="focus-role-chip">
          {user.role === "admin"
            ? isAr
              ? "مدير"
              : "Admin"
            : isAr
              ? "مدير فرعي"
              : "SubAdmin"}
        </span>
      </header>
      <FocusDecisionStrip
        eyebrow={isAr ? "الحالة الحالية" : "Current state"}
        title={
          queueLoading
            ? isAr
              ? "جارٍ فحص قائمة الانتظار"
              : "Checking the queue"
            : queue.length
              ? isAr
                ? "قرارات تحتاج إلى مراجعتك"
                : "Decisions need your review"
              : isAr
                ? "لا توجد قرارات معلقة"
                : "No decisions are waiting"
        }
        description={
          isAr
            ? "تعرض هذه القائمة العمل الذي تسمح به صلاحياتك فقط. افتح العنصر الأول لبدء المراجعة."
            : "This queue shows only work allowed by your permissions. Open the first item to begin review."
        }
        facts={[
          {
            label: isAr ? "بانتظارك" : "Waiting",
            value: queueLoading ? "—" : queue.length,
            tone: queue.length ? "attention" : "success",
          },
          {
            label: isAr ? "نطاقات متاحة" : "Visible scopes",
            value: visibleScopeCount,
          },
        ]}
        action={
          nextQueueItem ? (
            <Link className="btn-primary" href={nextQueueItem.href}>
              {isAr ? "مراجعة التالي" : "Review next"}
            </Link>
          ) : undefined
        }
      />
      <nav
        className="ops-scope-nav"
        aria-label={
          isAr ? "نطاق العمليات المتاح" : "Available operations scope"
        }
      >
        {canManageTutors && (
          <Link href="/admin?tab=tutors">{isAr ? "المعلّمون" : "Tutors"}</Link>
        )}
        {canManageStudents && (
          <Link href="/admin?tab=students">{isAr ? "الطلاب" : "Students"}</Link>
        )}
        {isFullAdmin && (
          <Link href="/admin">{isAr ? "كل العمليات" : "All operations"}</Link>
        )}
      </nav>
      {queueLoading ? (
        <div
          className="focus-skeleton"
          aria-label={isAr ? "جارٍ تحميل قائمة الانتظار" : "Loading queue"}
        />
      ) : stats.isError || pendingTutors.isError ? (
        <section className="focus-empty" role="alert">
          <h2>
            {isAr
              ? "تعذّر تحميل قائمة الانتظار"
              : "The queue could not be loaded"}
          </h2>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              void stats.refetch();
              void pendingTutors.refetch();
            }}
          >
            {isAr ? "إعادة المحاولة" : "Retry"}
          </button>
        </section>
      ) : queue.length ? (
        <section
          className="focus-panel"
          aria-label={isAr ? "عناصر قائمة الانتظار" : "Queue items"}
        >
          {queue.map((item) => (
            <Link className="queue-row" href={item.href} key={item.href}>
              <span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
              <DirectionalArrow />
            </Link>
          ))}
        </section>
      ) : (
        <section className="focus-empty">
          <h2>
            {isAr ? "لا توجد قرارات بانتظارك" : "No decisions are waiting"}
          </h2>
          <p>
            {isAr
              ? "ستظهر هنا العناصر التي تحتاج إلى تدخل بشري."
              : "Items needing a human decision will appear here."}
          </p>
        </section>
      )}
    </main>
  );
}
