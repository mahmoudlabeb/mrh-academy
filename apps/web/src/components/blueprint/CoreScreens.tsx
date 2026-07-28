"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, usePathname, useRouter } from "next/navigation";
import { LessonStatus } from "@mrh/types";
import { isAxiosError } from "axios";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";
import NotificationPreferencesPanel from "@/components/NotificationPreferencesPanel";
import { formatCurrency } from "@/lib/format";

function useCopy() {
  const { lang, setLanguage } = useLanguage();
  const { user } = useAuth();
  return {
    lang,
    setLanguage,
    t: (ar: string, en: string) => (lang === "ar" ? ar : en),
    date: (value: string) =>
      new Date(value).toLocaleString(lang === "ar" ? "ar-EG" : "en-US", {
        timeZone: user?.timezone ?? "Africa/Cairo",
      }),
  };
}

function StateBlock({
  loading,
  error,
  empty,
  emptyText,
  children,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  const { t } = useCopy();
  if (loading)
    return (
      <div
        className="skeleton h-28 rounded"
        aria-label={t("جارٍ التحميل", "Loading")}
      />
    );
  if (error)
    return (
      <p className="blueprint-error">
        {t("تعذر تحميل هذه البيانات.", "This data could not be loaded.")}
      </p>
    );
  if (empty) return <p className="blueprint-empty-row">{emptyText}</p>;
  return children;
}

type StudentLesson = {
  id: string;
  status: LessonStatus;
  date?: string;
  scheduledTime?: string;
  duration?: number;
  durationMinutes?: number;
  price: number;
  tutorName?: string;
  tutor?: { firstName?: string; lastName?: string };
};

function lessonStatusLabel(lang: "ar" | "en", status: LessonStatus): string {
  const labels: Record<LessonStatus, { ar: string; en: string }> = {
    [LessonStatus.PENDING]: { ar: "قيد الانتظار", en: "Pending" },
    [LessonStatus.CONFIRMED]: { ar: "مؤكد", en: "Confirmed" },
    [LessonStatus.COMPLETED]: { ar: "مكتمل", en: "Completed" },
    [LessonStatus.CANCELLED]: { ar: "ملغي", en: "Cancelled" },
  };
  return labels[status]?.[lang] ?? String(status);
}
type Enrollment = {
  courseId: string;
  progressPercentage: number;
  course?: { id: string; title: string };
};

export function LearnerTodayScreen() {
  const { lang, t, date } = useCopy();
  const balanceQuery = useQuery({
    queryKey: ["core-student-balance"],
    queryFn: async () =>
      (await apiClient.get<{ balance: number }>("/students/balance")).data,
  });
  const lessonsQuery = useQuery({
    queryKey: ["core-student-lessons"],
    queryFn: async () =>
      (await apiClient.get<StudentLesson[]>("/students/lessons")).data,
  });
  const coursesQuery = useQuery({
    queryKey: ["core-student-enrollments"],
    queryFn: async () =>
      (await apiClient.get<Enrollment[]>("/courses/my/enrollments")).data,
  });
  const nextLesson = (lessonsQuery.data ?? [])
    .filter((lesson) => lesson.status === LessonStatus.CONFIRMED)
    .sort(
      (a, b) =>
        new Date(a.scheduledTime ?? a.date ?? 0).getTime() -
        new Date(b.scheduledTime ?? b.date ?? 0).getTime(),
    )[0];
  return (
    <main className="blueprint-workspace-page">
      <header className="blueprint-workspace-head">
        <div>
          <p className="blueprint-kicker">
            {t("مساحة الطالب", "Learner focus")}
          </p>
          <h1>{t("اليوم", "Today")}</h1>
          <p>
            {t(
              "قراراتك النشطة وجلساتك وتقدمك.",
              "Your active decisions, upcoming sessions, and learning progress.",
            )}
          </p>
        </div>
        <Link className="btn-secondary" href={`/${lang}/learn/wallet`}>
          {t("الرصيد", "Balance")}:{" "}
          {formatCurrency(lang, Number(balanceQuery.data?.balance ?? 0))}
        </Link>
      </header>
      <section className="blueprint-decision-card">
        <p className="blueprint-kicker">
          {t("الدرس المؤكد التالي", "Next confirmed lesson")}
        </p>
        <StateBlock
          loading={lessonsQuery.isLoading}
          error={lessonsQuery.isError}
          empty={!nextLesson}
          emptyText={t(
            "لا يوجد درس مؤكد قريباً.",
            "No confirmed lesson is currently scheduled.",
          )}
        >
          {nextLesson && (
            <div className="blueprint-decision-row">
              <div>
                <h2>
                  {nextLesson.tutorName ??
                    `${nextLesson.tutor?.firstName ?? ""} ${nextLesson.tutor?.lastName ?? ""}`}
                </h2>
                <p>{date(nextLesson.scheduledTime ?? nextLesson.date ?? "")}</p>
              </div>
              <Link
                className="btn-primary"
                href={`/${lang}/lesson/${nextLesson.id}`}
              >
                {t("تفاصيل الدرس", "Lesson details")}
              </Link>
            </div>
          )}
        </StateBlock>
      </section>
      <section className="blueprint-table-section">
        <h2>{t("متابعة التعلم الذاتي", "Continue course learning")}</h2>
        <StateBlock
          loading={coursesQuery.isLoading}
          error={coursesQuery.isError}
          empty={!coursesQuery.data?.length}
          emptyText={t(
            "لم تسجل في دورة بعد.",
            "You have not enrolled in a course yet.",
          )}
        >
          <div className="blueprint-focus-list">
            {coursesQuery.data?.map((item) => (
              <article key={item.courseId}>
                <div>
                  <strong>
                    {item.course?.title ?? t("دورة مسجلة", "Enrolled course")}
                  </strong>
                  <p>
                    {Math.round(item.progressPercentage ?? 0)}%{" "}
                    {t("مكتمل", "complete")}
                  </p>
                </div>
                <Link
                  className="btn-primary"
                  href={`/${lang}/learn/courses/${item.courseId}`}
                >
                  {t("متابعة", "Continue")}
                </Link>
              </article>
            ))}
          </div>
        </StateBlock>
      </section>
      <div className="blueprint-quick-grid">
        <Link href={`/${lang}/tutors`}>
          {t("اعثر على معلم", "Find a tutor")}
        </Link>
        <Link href={`/${lang}/courses`}>
          {t("تصفح الدورات", "Browse courses")}
        </Link>
        <Link href={`/${lang}/learn/wallet/add`}>
          {t("أضف رصيداً", "Add wallet funds")}
        </Link>
      </div>
    </main>
  );
}

export function LearnerLessonsScreen() {
  const { lang, t, date } = useCopy();
  const [filter, setFilter] = useState<"upcoming" | "pending" | "past">(
    "upcoming",
  );
  const lessonsQuery = useQuery({
    queryKey: ["core-student-lessons"],
    queryFn: async () =>
      (await apiClient.get<StudentLesson[]>("/students/lessons")).data,
  });
  const visible = (lessonsQuery.data ?? []).filter((lesson) =>
    filter === "upcoming"
      ? lesson.status === LessonStatus.CONFIRMED
      : filter === "pending"
        ? lesson.status === LessonStatus.PENDING
        : lesson.status === LessonStatus.COMPLETED ||
          lesson.status === LessonStatus.CANCELLED,
  );
  return (
    <main className="blueprint-workspace-page">
      <header className="blueprint-workspace-head">
        <div>
          <p className="blueprint-kicker">
            {t("التعلم المباشر", "Live learning")}
          </p>
          <h1>{t("دروسي المباشرة", "My Live Lessons")}</h1>
          <p>
            {t(
              "الجلسات المجدولة والسجل والطلبات.",
              "Scheduled sessions, history, and action requests.",
            )}
          </p>
        </div>
        <Link
          className="btn-primary"
          href={`/${lang}/learn/classroom/practice`}
        >
          {t("فتح فصل التدريب", "Open practice classroom")}
        </Link>
      </header>
      <div className="blueprint-tabs" role="tablist">
        {(["upcoming", "pending", "past"] as const).map((key) => (
          <button
            role="tab"
            aria-selected={filter === key}
            aria-controls={`lessons-panel-${key}`}
            id={`lessons-tab-${key}`}
            key={key}
            onClick={() => setFilter(key)}
          >
            {key === "upcoming"
              ? t("قادمة", "Upcoming")
              : key === "pending"
                ? t("قيد الانتظار", "Pending")
                : t("السجل", "History")}
          </button>
        ))}
      </div>
      <section
        className="blueprint-table-section"
        role="tabpanel"
        id={`lessons-panel-${filter}`}
        aria-labelledby={`lessons-tab-${filter}`}
      >
        <h2>
          {filter === "upcoming"
            ? t("الجلسات المؤكدة القادمة", "Upcoming confirmed sessions")
            : filter === "pending"
              ? t("طلبات بانتظار القرار", "Requests awaiting a decision")
              : t("سجل الدروس", "Lesson history")}
        </h2>
        <StateBlock
          loading={lessonsQuery.isLoading}
          error={lessonsQuery.isError}
          empty={!visible.length}
          emptyText={t(
            "لا توجد عناصر في هذا القسم.",
            "There are no lessons in this section.",
          )}
        >
          <div className="blueprint-focus-list">
            {visible.map((lesson) => (
              <article key={lesson.id}>
                <div>
                  <strong>
                    {lesson.tutorName ??
                      `${lesson.tutor?.firstName ?? ""} ${lesson.tutor?.lastName ?? ""}`}
                  </strong>
                  <p>
                    {date(lesson.scheduledTime ?? lesson.date ?? "")} ·{" "}
                    {lesson.durationMinutes ?? lesson.duration ?? 0} min ·{" "}
                    {formatCurrency(lang, lesson.price)}
                  </p>
                </div>
                <span
                  className={`blueprint-status blueprint-status--${String(lesson.status).toLowerCase()}`}
                >
                  {lessonStatusLabel(lang, lesson.status)}
                </span>
                <Link
                  className="btn-secondary"
                  href={`/${lang}/lesson/${lesson.id}`}
                >
                  {t("التفاصيل", "Details")}
                </Link>
              </article>
            ))}
          </div>
        </StateBlock>
      </section>
    </main>
  );
}

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
  status: LessonStatus;
  scheduledTime: string;
  durationMinutes: number;
  price: number;
  student?: { firstName?: string; lastName?: string };
};
type LessonPage = { data: TutorLesson[] };

export function TutorTodayScreen() {
  const { lang, t, date } = useCopy();
  const statsQuery = useQuery({
    queryKey: ["core-tutor-stats"],
    queryFn: async () =>
      (await apiClient.get<TutorStats>("/tutors/me/stats")).data,
  });
  const lessonsQuery = useQuery({
    queryKey: ["core-tutor-lessons"],
    queryFn: async () => (await apiClient.get<LessonPage>("/lessons")).data,
  });
  const pending = (lessonsQuery.data?.data ?? []).filter(
    (lesson) => lesson.status === LessonStatus.PENDING,
  );
  const upcoming = (lessonsQuery.data?.data ?? [])
    .filter((lesson) => lesson.status === LessonStatus.CONFIRMED)
    .slice(0, 3);
  return (
    <main className="blueprint-workspace-page">
      <section className="blueprint-tutor-hero">
        <div>
          <p className="blueprint-kicker">
            {t("معلم معتمد", "Certified educator")}
          </p>
          <h1>
            {t("مساحة التدريس جاهزة", "Your teaching workspace is ready")}
          </h1>
          <p>
            {pending.length
              ? t(
                  `لديك ${pending.length} طلبات تحتاج قراراً.`,
                  `${pending.length} booking requests need a decision.`,
                )
              : t("لا توجد طلبات معلقة.", "No booking requests are waiting.")}
          </p>
        </div>
        <Link className="btn-primary" href={`/${lang}/teach/schedule`}>
          {t("الساعات والجدول", "Hours & schedule")}
        </Link>
      </section>
      <div className="blueprint-stat-grid">
        <section>
          <small>{t("الدروس المكتملة", "Completed lessons")}</small>
          <strong>{statsQuery.data?.completedLessons ?? "—"}</strong>
        </section>
        <section>
          <small>{t("صافي الأرباح", "Net earnings")}</small>
          <strong>
            {formatCurrency(lang, Number(statsQuery.data?.totalEarnings ?? 0))}
          </strong>
        </section>
        <section>
          <small>{t("الطلاب", "Students")}</small>
          <strong>{statsQuery.data?.studentCount ?? "—"}</strong>
        </section>
      </div>
      <section className="blueprint-table-section">
        <h2>{t("المواعيد القادمة", "Upcoming student appointments")}</h2>
        <StateBlock
          loading={lessonsQuery.isLoading}
          error={lessonsQuery.isError}
          empty={!upcoming.length}
          emptyText={t(
            "لا توجد جلسات مؤكدة قادمة.",
            "No confirmed sessions are upcoming.",
          )}
        >
          <div className="blueprint-focus-list">
            {upcoming.map((lesson) => (
              <article key={lesson.id}>
                <div>
                  <strong>
                    {lesson.student?.firstName} {lesson.student?.lastName}
                  </strong>
                  <p>
                    {date(lesson.scheduledTime)} · {lesson.durationMinutes} min
                  </p>
                </div>
                <Link
                  className="btn-primary"
                  href={`/${lang}/lesson/${lesson.id}`}
                >
                  {t("فتح الدرس", "Open lesson")}
                </Link>
              </article>
            ))}
          </div>
        </StateBlock>
      </section>
    </main>
  );
}

type Slot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
};

export function TutorScheduleScreen() {
  const { t } = useCopy();
  const queryClient = useQueryClient();
  const [day, setDay] = useState("1");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const slotsQuery = useQuery({
    queryKey: ["core-tutor-availability"],
    queryFn: async () =>
      (await apiClient.get<Slot[]>("/tutor/availability")).data,
  });
  const add = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post("/tutor/availability", {
          dayOfWeek: Number(day),
          startTime: start,
          endTime: end,
          isRecurring: true,
        })
      ).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["core-tutor-availability"] }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) =>
      apiClient.delete(`/tutor/availability/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["core-tutor-availability"] }),
  });
  const days = t(
    "الأحد,الإثنين,الثلاثاء,الأربعاء,الخميس,الجمعة,السبت",
    "Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",
  ).split(",");
  const valid = start < end;
  const overlappingSlot = (slotsQuery.data ?? []).find(
    (slot) =>
      slot.dayOfWeek === Number(day) &&
      start < slot.endTime.slice(0, 5) &&
      end > slot.startTime.slice(0, 5),
  );
  const addError = add.isError
    ? isAxiosError(add.error) &&
      typeof add.error.response?.data?.message === "string"
      ? add.error.response.data.message
      : t(
          "تعذر حفظ الساعات. حاول مرة أخرى.",
          "Working hours could not be saved. Please try again.",
        )
    : null;
  return (
    <main className="blueprint-workspace-page">
      <header className="blueprint-workspace-head">
        <div>
          <p className="blueprint-kicker">
            {t("إرشاد الحجز", "Booking guidance")}
          </p>
          <h1>{t("الجدول والساعات الحرة", "Schedule & Free Hours")}</h1>
          <p>
            {t(
              "انشر ساعات العمل المتكررة. يعيد الخادم التحقق من كل طلب حجز.",
              "Publish recurring working hours. The server revalidates every booking request.",
            )}
          </p>
        </div>
      </header>
      <section className="blueprint-surface">
        <h2>{t("إضافة ساعات عمل", "Add working hours")}</h2>
        <div className="blueprint-schedule-form">
          <label>
            {t("اليوم", "Day")}
            <select
              value={day}
              onChange={(event) => setDay(event.target.value)}
            >
              {days.map((label, index) => (
                <option value={index} key={label}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("البداية", "Start")}
            <input
              type="time"
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </label>
          <label>
            {t("النهاية", "End")}
            <input
              type="time"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          </label>
          <button
            className="btn-primary"
            disabled={!valid || Boolean(overlappingSlot) || add.isPending}
            onClick={() => add.mutate()}
          >
            {t("إضافة الساعات", "Add hours")}
          </button>
        </div>
        {!valid && (
          <p className="blueprint-error">
            {t(
              "يجب أن تكون النهاية بعد البداية.",
              "End time must be after start time.",
            )}
          </p>
        )}
        {valid && overlappingSlot && (
          <p className="blueprint-error" role="alert">
            {t(
              `هذه الساعات تتداخل مع ${overlappingSlot.startTime.slice(0, 5)}–${overlappingSlot.endTime.slice(0, 5)}. احذف الفترة الحالية أو اختر وقتاً آخر.`,
              `These hours overlap ${overlappingSlot.startTime.slice(0, 5)}–${overlappingSlot.endTime.slice(0, 5)}. Delete the existing period or choose another time.`,
            )}
          </p>
        )}
        {addError && (
          <p className="blueprint-error" role="alert">
            {addError}
          </p>
        )}
        <div className="blueprint-slot-list">
          {slotsQuery.data?.map((slot) => (
            <span key={slot.id}>
              {days[slot.dayOfWeek]} {slot.startTime.slice(0, 5)}–
              {slot.endTime.slice(0, 5)}{" "}
              <button
                aria-label={t("حذف", "Delete")}
                onClick={() => remove.mutate(slot.id)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}

export function TutorClassroomScreen() {
  const { lang, t, date } = useCopy();
  const lessonsQuery = useQuery({
    queryKey: ["core-tutor-classroom-lessons"],
    queryFn: async () => (await apiClient.get<LessonPage>("/lessons")).data,
  });
  const confirmed = (lessonsQuery.data?.data ?? []).filter(
    (lesson) => lesson.status === "confirmed",
  );
  return (
    <main className="blueprint-workspace-page">
      <header className="blueprint-workspace-head">
        <div>
          <p className="blueprint-kicker">
            {t("الفصل الأصلي", "Native classroom")}
          </p>
          <h1>{t("الفصول المباشرة", "Live Classrooms")}</h1>
          <p>
            {t(
              "افتح فقط الغرف المرتبطة بدروس مؤكدة من الخادم.",
              "Open only rooms attached to server-confirmed lessons.",
            )}
          </p>
        </div>
      </header>
      <section className="blueprint-table-section">
        <h2>{t("الجلسات المؤكدة", "Confirmed sessions")}</h2>
        <StateBlock
          loading={lessonsQuery.isLoading}
          error={lessonsQuery.isError}
          empty={!confirmed.length}
          emptyText={t(
            "لا توجد غرفة مؤكدة جاهزة.",
            "No confirmed classroom is ready.",
          )}
        >
          <div className="blueprint-focus-list">
            {confirmed.map((lesson) => (
              <article key={lesson.id}>
                <div>
                  <strong>
                    {lesson.student?.firstName} {lesson.student?.lastName}
                  </strong>
                  <p>
                    {date(lesson.scheduledTime)} · {lesson.durationMinutes} min
                  </p>
                </div>
                <Link
                  className="btn-primary"
                  href={`/${lang}/lesson/${lesson.id}`}
                >
                  {t("تفاصيل ودخول", "Details & entry")}
                </Link>
              </article>
            ))}
          </div>
        </StateBlock>
      </section>
      <p className="blueprint-note">
        {t(
          "يظل Google Meet خياراً ثانوياً فقط عندما يرسله الخادم ضمن سجل الدرس.",
          "Google Meet remains secondary and appears only when supplied by the lesson record.",
        )}
      </p>
    </main>
  );
}

export function OperationsQueueScreen() {
  const { lang, t } = useCopy();
  const { user } = useAuth();
  const permissions = new Set(user?.assignedPermissions ?? []);
  const fullAdmin = user?.role === "admin";
  const canTutors = fullAdmin || permissions.has("manage_tutors");
  const canStudents = fullAdmin || permissions.has("manage_students");
  const stats = useQuery({
    queryKey: ["core-ops-stats"],
    queryFn: async () =>
      (
        await apiClient.get<{
          pendingApplications: number;
          openReports: number;
        }>("/admin/stats")
      ).data,
    enabled: fullAdmin,
  });
  const pendingTutors = useQuery({
    queryKey: ["core-ops-pending-tutors"],
    queryFn: async () =>
      (await apiClient.get<unknown[]>("/admin/tutors/pending")).data,
    enabled: Boolean(user && canTutors && !fullAdmin),
  });
  const pendingTutorCount = fullAdmin
    ? Number(stats.data?.pendingApplications ?? 0)
    : Number(pendingTutors.data?.length ?? 0);
  const queue = [
    ...(canTutors && pendingTutorCount
      ? [
          {
            key: "tutors",
            title: t("طلبات معلمين", "Tutor applications"),
            detail: t(
              `${pendingTutorCount} بانتظار المراجعة`,
              `${pendingTutorCount} awaiting review`,
            ),
            href: `/${lang}/ops/people`,
          },
        ]
      : []),
    ...(fullAdmin && stats.data?.openReports
      ? [
          {
            key: "reports",
            title: t("بلاغات مفتوحة", "Open reports"),
            detail: t(
              `${stats.data.openReports} تحتاج مراجعة`,
              `${stats.data.openReports} need review`,
            ),
            href: `/${lang}/ops/settings`,
          },
        ]
      : []),
  ];
  const loading = stats.isLoading || pendingTutors.isLoading;
  const error = stats.isError || pendingTutors.isError;
  return (
    <main className="blueprint-workspace-page">
      <header className="blueprint-workspace-head">
        <div>
          <p className="blueprint-kicker">
            {t("قائمة أولويات العمليات", "Operations priority work-list")}
          </p>
          <h1>{t("قائمة قرارات العمليات", "Operations Decision Queue")}</h1>
          <p>
            {t(
              "تظهر الأعمال ضمن الصلاحيات التي أصدرها الخادم فقط.",
              "Only work inside server-issued permissions is shown.",
            )}
          </p>
        </div>
        <span className="focus-role-chip">{user?.role}</span>
      </header>
      <section className="blueprint-decision-card">
        <p className="blueprint-kicker">
          {t("الحالة الحالية", "Current state")}
        </p>
        <div className="blueprint-decision-row">
          <div>
            <h2>
              {loading
                ? t("جارٍ فحص القائمة", "Checking the queue")
                : queue.length
                  ? t("قرارات تحتاج مراجعتك", "Decisions need your review")
                  : t("لا قرارات معلقة", "No decisions are waiting")}
            </h2>
            <p>
              {t(
                "لا تعرض الواجهة إجراءات خارج نطاقك.",
                "The interface does not expose actions outside your scope.",
              )}
            </p>
          </div>
          <strong>{loading ? "—" : queue.length}</strong>
        </div>
      </section>
      <section className="blueprint-table-section">
        <h2>{t("العمل المتاح", "Available work")}</h2>
        <StateBlock
          loading={loading}
          error={error}
          empty={!queue.length}
          emptyText={t(
            "لا توجد قرارات بانتظارك.",
            "No decisions are waiting for you.",
          )}
        >
          <div className="blueprint-focus-list">
            {queue.map((item) => (
              <article key={item.key}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <Link className="btn-primary" href={item.href}>
                  {t("مراجعة", "Review")}
                </Link>
              </article>
            ))}
          </div>
        </StateBlock>
      </section>
      <nav className="blueprint-quick-grid">
        {canTutors && (
          <Link href={`/${lang}/ops/people#tutors`}>
            {t("المعلمون", "Tutors")}
          </Link>
        )}
        {canStudents && (
          <Link href={`/${lang}/ops/people#students`}>
            {t("الطلاب", "Students")}
          </Link>
        )}
        {fullAdmin && (
          <Link href={`/${lang}/ops/money/payments`}>
            {t("المدفوعات", "Payments")}
          </Link>
        )}
      </nav>
    </main>
  );
}

type Contact = {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  };
  lastMessage: { content: string; createdAt: string } | null;
  unreadCount: number;
};
type Message = {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
};

export function MessagesScreen() {
  const { lang, t, date } = useCopy();
  const { user, isLoading } = useAuth();
  const params = useParams<{ userId?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(
    params.userId ?? null,
  );
  const [draft, setDraft] = useState("");
  useEffect(() => {
    setSelected(params.userId ?? null);
  }, [params.userId]);
  const contactsQuery = useQuery({
    queryKey: ["core-message-contacts"],
    queryFn: async () =>
      (await apiClient.get<Contact[]>("/messages/contacts")).data,
    enabled: Boolean(user),
  });
  const active = selected ?? contactsQuery.data?.[0]?.user.id ?? null;
  const messagesQuery = useQuery({
    queryKey: ["core-conversation", active],
    queryFn: async () =>
      (await apiClient.get<{ messages: Message[] }>(`/messages/${active}`))
        .data,
    enabled: Boolean(active),
  });
  const send = useMutation({
    mutationFn: async () =>
      apiClient.post("/messages", {
        receiverId: active,
        content: draft.trim(),
      }),
    onSuccess: async () => {
      setDraft("");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["core-conversation", active],
        }),
        queryClient.invalidateQueries({ queryKey: ["core-message-contacts"] }),
        queryClient.invalidateQueries({ queryKey: ["messages-unread"] }),
      ]);
    },
  });
  if (isLoading)
    return (
      <main className="focus-page">
        <div className="focus-skeleton" />
      </main>
    );
  if (!user)
    return (
      <main className="focus-page blueprint-result">
        <h1>{t("سجل الدخول لعرض رسائلك", "Sign in to view your messages")}</h1>
        <Link
          className="btn-primary"
          href={`/${lang}/sign-in?next=${encodeURIComponent(`/${lang}/messages`)}`}
        >
          {t("تسجيل الدخول", "Sign in")}
        </Link>
      </main>
    );
  if (user.role !== "student" && user.role !== "tutor")
    return (
      <main className="focus-page blueprint-result">
        <h1>
          {t(
            "الرسائل غير متاحة لهذا الدور",
            "Messages are unavailable for this role",
          )}
        </h1>
        <Link className="btn-secondary" href={`/${lang}/ops`}>
          {t("العودة للعمليات", "Return to operations")}
        </Link>
      </main>
    );
  const contacts = contactsQuery.data ?? [];
  const current = contacts.find((contact) => contact.user.id === active);
  return (
    <main className="focus-page">
      <header className="focus-page-header">
        <div>
          <p className="focus-eyebrow">
            {t("محادثات مباشرة", "Direct conversations")}
          </p>
          <h1>{t("الرسائل", "Messages")}</h1>
        </div>
        <Link
          className="btn-secondary"
          href={`/${lang}/${user.role === "tutor" ? "teach" : "learn"}`}
        >
          {t("العودة لمساحة العمل", "Return to workspace")}
        </Link>
      </header>
      <section className="blueprint-messages">
        <aside>
          <h2>{t("المحادثات", "Conversations")}</h2>
          <StateBlock
            loading={contactsQuery.isLoading}
            error={contactsQuery.isError}
            empty={!contacts.length}
            emptyText={t("لا توجد محادثات.", "No conversations yet.")}
          >
            {contacts.map((contact) => (
              <button
                key={contact.user.id}
                className={active === contact.user.id ? "active" : ""}
                aria-pressed={active === contact.user.id}
                onClick={() => {
                  setSelected(contact.user.id);
                  router.push(`/${lang}/messages/${contact.user.id}`);
                }}
              >
                <span className="blueprint-contact-avatar" aria-hidden="true">
                  {contact.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={contact.user.avatarUrl} alt="" />
                  ) : (
                    `${contact.user.firstName[0] ?? ""}${contact.user.lastName[0] ?? ""}`
                  )}
                </span>
                <span className="blueprint-contact-copy">
                  <span>
                    <strong>
                      {contact.user.firstName} {contact.user.lastName}
                    </strong>
                    {contact.lastMessage && (
                      <time dateTime={contact.lastMessage.createdAt}>
                        {date(contact.lastMessage.createdAt)}
                      </time>
                    )}
                  </span>
                  <small>
                    {contact.lastMessage?.content ??
                      t("ابدأ المحادثة", "Start conversation")}
                  </small>
                </span>
                {contact.unreadCount > 0 && (
                  <span
                    className="blueprint-unread-count"
                    aria-label={t(
                      `${contact.unreadCount} رسائل غير مقروءة`,
                      `${contact.unreadCount} unread messages`,
                    )}
                  >
                    {contact.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </StateBlock>
        </aside>
        <div className="blueprint-conversation">
          <header>
            <strong>
              {current
                ? `${current.user.firstName} ${current.user.lastName}`
                : active
                  ? t("محادثة مباشرة", "Direct conversation")
                  : t("اختر محادثة", "Select a conversation")}
            </strong>
          </header>
          <div className="blueprint-message-list">
            <StateBlock
              loading={messagesQuery.isLoading}
              error={messagesQuery.isError}
              empty={!messagesQuery.data?.messages.length}
              emptyText={t("لا توجد رسائل بعد.", "No messages yet.")}
            >
              {messagesQuery.data?.messages.map((message) => (
                <article
                  className={message.senderId === user.id ? "mine" : ""}
                  key={message.id}
                >
                  <p>{message.content}</p>
                  <small>{date(message.createdAt)}</small>
                </article>
              ))}
            </StateBlock>
          </div>
          {send.isError && (
            <p className="blueprint-error" role="alert">
              {isAxiosError(send.error) &&
              typeof send.error.response?.data?.message === "string"
                ? send.error.response.data.message
                : t("تعذر إرسال الرسالة.", "The message could not be sent.")}
            </p>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.trim() && active) send.mutate();
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={!active}
              placeholder={t("اكتب رسالة", "Type a message")}
            />
            <button
              className="btn-primary"
              disabled={!active || !draft.trim() || send.isPending}
            >
              {t("إرسال", "Send")}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

type Notice = {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

export function NotificationsScreen() {
  const { lang, t, date } = useCopy();
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const notices = useQuery({
    queryKey: ["core-notifications"],
    queryFn: async () => (await apiClient.get<Notice[]>("/notifications")).data,
    enabled: Boolean(user),
  });
  const read = useMutation({
    mutationFn: async (id: string) =>
      apiClient.patch(`/notifications/${id}/read`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["core-notifications"] }),
  });
  const readAll = useMutation({
    mutationFn: async () => apiClient.post("/notifications/read-all"),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["core-notifications"] }),
  });
  if (!isLoading && !user)
    return (
      <main className="focus-page blueprint-result">
        <h1>
          {t("سجل الدخول لعرض الإشعارات", "Sign in to view notifications")}
        </h1>
        <Link
          className="btn-primary"
          href={`/${lang}/sign-in?next=${encodeURIComponent(`/${lang}/notifications`)}`}
        >
          {t("تسجيل الدخول", "Sign in")}
        </Link>
      </main>
    );
  return (
    <main className="focus-page">
      <header className="focus-page-header">
        <div>
          <p className="focus-eyebrow">
            {t("تحديثات الحساب", "Account updates")}
          </p>
          <h1>{t("الإشعارات", "Notifications")}</h1>
        </div>
        <button
          className="btn-secondary"
          disabled={
            readAll.isPending || !notices.data?.some((item) => !item.isRead)
          }
          onClick={() => readAll.mutate()}
        >
          {t("تحديد الكل كمقروء", "Mark all read")}
        </button>
      </header>
      <section className="focus-panel">
        <StateBlock
          loading={notices.isLoading}
          error={notices.isError}
          empty={!notices.data?.length}
          emptyText={t("لا توجد إشعارات.", "No notifications yet.")}
        >
          <div className="blueprint-focus-list">
            {notices.data?.map((notice) => (
              <article
                key={notice.id}
                className={!notice.isRead ? "unread" : ""}
              >
                <div>
                  <strong>{notice.title}</strong>
                  <p>{notice.body}</p>
                  <small>{date(notice.createdAt)}</small>
                </div>
                {!notice.isRead && (
                  <button
                    className="btn-secondary"
                    onClick={() => read.mutate(notice.id)}
                  >
                    {t("تمت القراءة", "Mark read")}
                  </button>
                )}
              </article>
            ))}
          </div>
        </StateBlock>
      </section>
    </main>
  );
}

type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  timezone?: string;
  role: string;
};

export function AccountScreen() {
  const pathname = usePathname();
  const { lang, setLanguage, t } = useCopy();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const section = pathname.split("/").at(-1) ?? "profile";
  const me = useQuery({
    queryKey: ["core-account"],
    queryFn: async () => (await apiClient.get<UserProfile>("/users/me")).data,
  });
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    timezone: "Africa/Cairo",
  });
  const [hydratedId, setHydratedId] = useState("");
  useEffect(() => {
    if (!me.data || hydratedId === me.data.id) return;
    setHydratedId(me.data.id);
    setProfile({
      firstName: me.data.firstName ?? "",
      lastName: me.data.lastName ?? "",
      phone: me.data.phone ?? "",
      timezone: me.data.timezone ?? "Africa/Cairo",
    });
  }, [hydratedId, me.data]);
  const save = useMutation({
    mutationFn: async () => apiClient.patch("/users/profile", profile),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["core-account"] }),
  });
  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const changePassword = useMutation({
    mutationFn: async () => apiClient.patch("/users/change-password", password),
    onSuccess: () => setPassword({ currentPassword: "", newPassword: "" }),
  });
  const sections = [
    ["profile", t("الملف الشخصي", "Profile")],
    ["security", t("الأمان", "Security")],
    ["notifications", t("تفضيلات الإشعار", "Notifications")],
    ["appearance", t("اللغة والمظهر", "Language & theme")],
    ["roles", t("الأدوار", "Roles")],
  ];
  return (
    <main className="focus-page">
      <header className="focus-page-header">
        <div>
          <p className="focus-eyebrow">
            {t("إدارة الحساب", "Account control")}
          </p>
          <h1>{t("إعدادات الحساب", "Account Settings")}</h1>
        </div>
        {me.data && (
          <Link
            className="btn-secondary"
            href={
              me.data.role === "tutor"
                ? `/${lang}/teach`
                : me.data.role === "admin" || me.data.role === "subadmin"
                  ? `/${lang}/ops`
                  : `/${lang}/learn`
            }
          >
            {t("العودة إلى مساحة العمل", "Return to dashboard")}
          </Link>
        )}
      </header>
      <div className="blueprint-account">
        <nav>
          {sections.map(([key, label]) => (
            <Link
              className={
                section === key || (section === "account" && key === "profile")
                  ? "active"
                  : ""
              }
              key={key}
              href={`/${lang}/account/${key}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <section className="blueprint-surface">
          <StateBlock
            loading={me.isLoading}
            error={me.isError}
            empty={false}
            emptyText=""
          >
            {(section === "profile" || section === "account") && (
              <form
                className="blueprint-account-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  save.mutate();
                }}
              >
                <h2>{t("تفاصيل الملف", "Profile details")}</h2>
                <label>
                  {t("الاسم الأول", "First name")}
                  <input
                    value={profile.firstName}
                    onChange={(event) =>
                      setProfile({ ...profile, firstName: event.target.value })
                    }
                  />
                </label>
                <label>
                  {t("اسم العائلة", "Last name")}
                  <input
                    value={profile.lastName}
                    onChange={(event) =>
                      setProfile({ ...profile, lastName: event.target.value })
                    }
                  />
                </label>
                <label>
                  {t("الهاتف", "Phone")}
                  <input
                    value={profile.phone}
                    onChange={(event) =>
                      setProfile({ ...profile, phone: event.target.value })
                    }
                  />
                </label>
                <label>
                  {t("المنطقة الزمنية", "Timezone")}
                  <input
                    value={profile.timezone}
                    onChange={(event) =>
                      setProfile({ ...profile, timezone: event.target.value })
                    }
                  />
                </label>
                <button className="btn-primary" disabled={save.isPending}>
                  {t("حفظ التغييرات", "Save changes")}
                </button>
                {save.isError && (
                  <p className="blueprint-error">
                    {t(
                      "تعذر حفظ الملف.",
                      "Profile changes could not be saved.",
                    )}
                  </p>
                )}
              </form>
            )}
            {section === "security" && (
              <form
                className="blueprint-account-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  changePassword.mutate();
                }}
              >
                <h2>{t("تغيير كلمة المرور", "Change password")}</h2>
                <label>
                  {t("كلمة المرور الحالية", "Current password")}
                  <input
                    type="password"
                    value={password.currentPassword}
                    onChange={(event) =>
                      setPassword({
                        ...password,
                        currentPassword: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  {t("كلمة المرور الجديدة", "New password")}
                  <input
                    type="password"
                    minLength={8}
                    value={password.newPassword}
                    onChange={(event) =>
                      setPassword({
                        ...password,
                        newPassword: event.target.value,
                      })
                    }
                  />
                </label>
                <button
                  className="btn-primary"
                  disabled={
                    changePassword.isPending || password.newPassword.length < 8
                  }
                >
                  {t("تحديث كلمة المرور", "Update password")}
                </button>
                {changePassword.isError && (
                  <p className="blueprint-error">
                    {t("تعذر تغيير كلمة المرور.", "Password change failed.")}
                  </p>
                )}
              </form>
            )}
            {section === "notifications" && (
              <NotificationPreferencesPanel lang={lang} t={t} />
            )}
            {section === "appearance" && (
              <div className="blueprint-account-form">
                <h2>{t("اللغة والمظهر", "Language & theme")}</h2>
                <fieldset>
                  <legend>{t("اللغة", "Language")}</legend>
                  <div className="blueprint-choice-row">
                    <button
                      aria-pressed={lang === "en"}
                      onClick={() => setLanguage("en")}
                    >
                      English
                    </button>
                    <button
                      aria-pressed={lang === "ar"}
                      onClick={() => setLanguage("ar")}
                    >
                      العربية
                    </button>
                  </div>
                </fieldset>
                <fieldset>
                  <legend>{t("المظهر", "Theme")}</legend>
                  <div className="blueprint-choice-row">
                    <button
                      aria-pressed={theme === "light"}
                      onClick={() => setTheme("light")}
                    >
                      {t("نهاري", "Daylight")}
                    </button>
                    <button
                      aria-pressed={theme === "dark"}
                      onClick={() => setTheme("dark")}
                    >
                      {t("داكن", "Dark")}
                    </button>
                  </div>
                </fieldset>
              </div>
            )}
            {section === "roles" && (
              <div className="blueprint-account-form">
                <h2>{t("الأدوار والتطبيقات", "Roles & applications")}</h2>
                <p>
                  {t("الدور الحالي", "Current role")}:{" "}
                  <strong>{me.data?.role}</strong>
                </p>
                {me.data?.role === "student" && (
                  <Link
                    className="btn-primary"
                    href={`/${lang}/become-a-tutor`}
                  >
                    {t("التقدم للتدريس", "Apply to teach")}
                  </Link>
                )}
              </div>
            )}
          </StateBlock>
        </section>
      </div>
    </main>
  );
}
