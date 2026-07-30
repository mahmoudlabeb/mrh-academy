"use client";

import Image from "next/image";
import {
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import { apiClient } from "@/lib/api-client";

type BookingStatus = "confirmed" | "completed" | "cancelled" | string;
type PaymentStatus = "paid" | "refunded" | string;

export type TutorBooking = {
  id: string;
  scheduledTime: string;
  endTime?: string | null;
  durationMinutes: number;
  price: number;
  status: BookingStatus;
  sessionStatus?: string | null;
  paymentStatus?: PaymentStatus | null;
  timezone?: string | null;
  meetUrl?: string | null;
  googleMeetUrl?: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  };
};

type LessonsResponse =
  | TutorBooking[]
  | {
      data?: TutorBooking[];
      totalPages?: number;
    };

type Tab = "upcoming" | "history";

const BOOKING_QUERY_KEY = ["tutor-bookings"] as const;

function lessonCollection(response: LessonsResponse): TutorBooking[] {
  const lessons = Array.isArray(response) ? response : (response.data ?? []);
  const seen = new Set<string>();

  return lessons.filter((lesson) => {
    if (!lesson?.id || seen.has(lesson.id)) return false;
    seen.add(lesson.id);
    return true;
  });
}

function formatter(
  locale: string,
  timezone: string,
  options: Intl.DateTimeFormatOptions,
) {
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: timezone });
  } catch {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
  }
}

function dateParts(value: string, timezone: string, locale: string) {
  const date = new Date(value);
  return {
    date: formatter(locale, timezone, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date),
    time: formatter(locale, timezone, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
  };
}

function inputValueInZone(value: string, timezone: string) {
  const parts = formatter("en-CA", timezone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function localTimeToIso(value: string, timezone: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) throw new Error("Invalid date");

  const [, year, month, day, hour, minute] = match.map(Number);
  const requestedUtc = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = requestedUtc;

  for (let index = 0; index < 3; index += 1) {
    const parts = formatter("en-CA", timezone, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(candidate));
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((item) => item.type === type)?.value ?? 0);
    const representedUtc = Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour"),
      part("minute"),
      part("second"),
    );
    candidate += requestedUtc - representedUtc;
  }

  return new Date(candidate).toISOString();
}

function errorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? fallback
  );
}

function StatusBadge({
  testId,
  label,
  tone,
}: {
  testId: string;
  label: string;
  tone: "positive" | "danger" | "neutral";
}) {
  const style =
    tone === "positive"
      ? {
          background: "var(--success-soft)",
          color: "var(--success)",
          borderColor: "color-mix(in srgb, var(--success) 28%, var(--border))",
        }
      : tone === "danger"
        ? {
            background: "var(--danger-soft)",
            color: "var(--danger)",
            borderColor: "color-mix(in srgb, var(--danger) 28%, var(--border))",
          }
        : {
            background: "var(--canvas-sunken)",
            color: "var(--ink-muted)",
            borderColor: "var(--border)",
          };

  return (
    <span
      className="inline-flex min-h-7 items-center rounded-md border px-2.5 py-1 text-xs font-semibold"
      style={style}
      data-testid={testId}
    >
      {label}
    </span>
  );
}

function DialogFrame({
  titleId,
  onClose,
  children,
}: {
  titleId: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>(
      'input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'input:not(:disabled), button:not(:disabled), [href], select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="focus-card w-full max-w-lg overflow-hidden shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}

function CloseButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="btn-ghost min-h-10 min-w-10 p-2 text-xl leading-none"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      ×
    </button>
  );
}

function BookingSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="focus-card grid min-h-44 animate-pulse gap-4 p-5 sm:grid-cols-[10rem_1fr]"
        >
          <div className="rounded-lg bg-[var(--canvas-sunken)]" />
          <div className="space-y-3 py-2">
            <div className="h-5 w-40 rounded bg-[var(--canvas-sunken)]" />
            <div className="h-4 w-28 rounded bg-[var(--canvas-sunken)]" />
            <div className="h-10 rounded bg-[var(--canvas-sunken)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function BookingCard({
  lesson,
  locale,
  lang,
  onReschedule,
  onCancel,
}: {
  lesson: TutorBooking;
  locale: string;
  lang: "ar" | "en";
  onReschedule: (lesson: TutorBooking) => void;
  onCancel: (lesson: TutorBooking) => void;
}) {
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const timezone = lesson.timezone || "UTC";
  const appointment = dateParts(lesson.scheduledTime, timezone, locale);
  const studentName =
    `${lesson.student?.firstName ?? ""} ${lesson.student?.lastName ?? ""}`.trim() ||
    t("طالب", "Student");
  const initials =
    `${lesson.student?.firstName?.[0] ?? ""}${lesson.student?.lastName?.[0] ?? ""}` ||
    "S";
  const paymentStatus = lesson.paymentStatus ?? "paid";
  const sessionStatus = lesson.sessionStatus ?? lesson.status;
  const confirmed = lesson.status === "confirmed";
  const room = lesson.meetUrl || lesson.googleMeetUrl;
  const joinHref = lesson.meetUrl
    ? /^https?:\/\//i.test(lesson.meetUrl)
      ? lesson.meetUrl
      : `/classroom/${encodeURIComponent(lesson.meetUrl)}`
    : lesson.googleMeetUrl || "";
  const externalJoin = /^https?:\/\//i.test(joinHref);
  const paymentLabel =
    paymentStatus === "refunded"
      ? t("مُسترد", "Refunded")
      : paymentStatus === "paid"
        ? t("مدفوع", "Paid")
        : paymentStatus;
  const sessionLabel =
    sessionStatus === "confirmed"
      ? t("مؤكد", "Confirmed")
      : sessionStatus === "completed"
        ? t("مكتمل", "Completed")
        : sessionStatus === "cancelled"
          ? t("ملغي", "Cancelled")
          : sessionStatus;

  return (
    <article
      className="focus-card grid gap-0 sm:grid-cols-[11rem_minmax(0,1fr)]"
      data-testid="lesson-card"
      data-lesson-id={lesson.id}
    >
      <div
        className="flex flex-col justify-center border-b border-s-4 p-5 sm:border-b-0 sm:border-e"
        style={{
          borderColor: "color-mix(in srgb, var(--signal) 55%, var(--border))",
          background:
            "color-mix(in srgb, var(--signal-soft) 64%, var(--surface))",
        }}
        data-testid="lesson-time-rail"
      >
        <time
          className="text-sm font-semibold text-[var(--ink-muted)]"
          dateTime={lesson.scheduledTime}
          data-testid="lesson-date"
        >
          {appointment.date}
        </time>
        <strong
          className="mt-1 text-2xl leading-tight text-[var(--ink)]"
          data-testid="lesson-time"
        >
          {appointment.time}
        </strong>
        <span
          className="mt-2 break-all font-mono text-[11px] text-[var(--ink-muted)]"
          dir="ltr"
          data-testid="lesson-timezone"
        >
          {timezone}
        </span>
        <span
          className="mt-1 text-xs font-medium text-[var(--ink-muted)]"
          data-testid="lesson-duration"
        >
          {lesson.durationMinutes} {t("دقيقة", "minutes")}
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold"
              style={{
                background:
                  "color-mix(in srgb, var(--signal) 16%, transparent)",
                color: "var(--signal-strong)",
              }}
              aria-hidden="true"
            >
              {lesson.student?.avatarUrl ? (
                <Image
                  src={lesson.student.avatarUrl}
                  alt=""
                  width={48}
                  height={48}
                  sizes="48px"
                  className="h-full w-full object-cover"
                />
              ) : (
                initials.toUpperCase()
              )}
            </span>
            <div className="min-w-0">
              <h3
                className="truncate font-bold text-[var(--ink)]"
                data-testid="lesson-student"
              >
                {studentName}
              </h3>
              <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
                {new Intl.NumberFormat(locale, {
                  style: "currency",
                  currency: "USD",
                }).format(Number(lesson.price) || 0)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              testId="payment-status"
              label={paymentLabel}
              tone={paymentStatus === "refunded" ? "danger" : "positive"}
            />
            <StatusBadge
              testId="session-status"
              label={sessionLabel}
              tone={
                sessionStatus === "cancelled"
                  ? "danger"
                  : sessionStatus === "confirmed"
                    ? "positive"
                    : "neutral"
              }
            />
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
          {confirmed && room && (
            <a
              className="btn-primary"
              href={joinHref}
              target={externalJoin ? "_blank" : undefined}
              rel={externalJoin ? "noreferrer" : undefined}
              data-testid="join-lesson"
            >
              {t("دخول الفصل", "Join Classroom")}
            </a>
          )}
          {confirmed && (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onReschedule(lesson)}
                data-testid="reschedule-lesson"
              >
                {t("إعادة الجدولة", "Reschedule")}
              </button>
              <button
                type="button"
                className="btn-ghost text-[var(--danger)]"
                onClick={() => onCancel(lesson)}
                data-testid="cancel-lesson"
              >
                {t("إلغاء", "Cancel")}
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export function TutorBookings({
  title,
  description,
  initialTab = "upcoming",
}: {
  title?: string;
  description?: string;
  initialTab?: Tab;
}) {
  const { lang } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [rescheduleLesson, setRescheduleLesson] = useState<TutorBooking | null>(
    null,
  );
  const [rescheduleValue, setRescheduleValue] = useState("");
  const [cancelLesson, setCancelLesson] = useState<TutorBooking | null>(null);
  const [notice, setNotice] = useState("");
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const isTutor = user?.role === "tutor";

  const lessonsQuery = useQuery({
    queryKey: BOOKING_QUERY_KEY,
    queryFn: async () => {
      const { data: firstPage } = await apiClient.get<LessonsResponse>(
        "/lessons",
        {
          params: { page: 1, limit: 100 },
        },
      );
      if (Array.isArray(firstPage)) return lessonCollection(firstPage);

      const totalPages = Math.max(1, Number(firstPage.totalPages ?? 1));
      const remainingPages =
        totalPages > 1
          ? await Promise.all(
              Array.from({ length: totalPages - 1 }, (_, index) =>
                apiClient.get<LessonsResponse>("/lessons", {
                  params: { page: index + 2, limit: 100 },
                }),
              ),
            )
          : [];
      const lessons = [
        ...(firstPage.data ?? []),
        ...remainingPages.flatMap(({ data: page }) =>
          Array.isArray(page) ? page : (page.data ?? []),
        ),
      ];
      return lessonCollection(lessons);
    },
    enabled: !authLoading && isTutor,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });

  const lessons = useMemo(() => lessonsQuery.data ?? [], [lessonsQuery.data]);
  const upcoming = useMemo(
    () =>
      lessons
        .filter((lesson) => lesson.status === "confirmed")
        .sort(
          (first, second) =>
            new Date(first.scheduledTime).getTime() -
            new Date(second.scheduledTime).getTime(),
        ),
    [lessons],
  );
  const history = useMemo(
    () => lessons.filter((lesson) => lesson.status !== "confirmed"),
    [lessons],
  );
  const displayed = activeTab === "upcoming" ? upcoming : history;

  const refreshBookingQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: BOOKING_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ["core-tutor-lessons"] }),
      queryClient.invalidateQueries({ queryKey: ["tutor-lessons-page"] }),
      queryClient.invalidateQueries({ queryKey: ["tutor-all-lessons"] }),
      queryClient.invalidateQueries({ queryKey: ["tutor-active-lessons"] }),
    ]);
  };

  const reschedule = useMutation({
    mutationFn: async ({
      id,
      scheduledTime,
    }: {
      id: string;
      scheduledTime: string;
    }) =>
      apiClient.patch(`/lessons/${id}/reschedule`, {
        scheduledTime,
      }),
    onSuccess: async () => {
      setRescheduleLesson(null);
      setNotice(t("تم تحديث موعد الدرس.", "Lesson time updated."));
      await refreshBookingQueries();
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => apiClient.post(`/lessons/${id}/cancel`),
    onSuccess: async () => {
      setCancelLesson(null);
      setNotice(
        t(
          "تم إلغاء الدرس وإعادة المبلغ كاملاً إلى الطالب.",
          "Lesson cancelled and fully refunded to the student.",
        ),
      );
      await refreshBookingQueries();
    },
  });

  const openReschedule = (lesson: TutorBooking) => {
    reschedule.reset();
    setNotice("");
    setRescheduleValue(
      inputValueInZone(
        lesson.scheduledTime,
        lesson.timezone || user?.timezone || "UTC",
      ),
    );
    setRescheduleLesson(lesson);
  };

  const submitReschedule = (event: FormEvent) => {
    event.preventDefault();
    if (!rescheduleLesson || !rescheduleValue) return;
    const timezone = rescheduleLesson.timezone || user?.timezone || "UTC";
    try {
      reschedule.mutate({
        id: rescheduleLesson.id,
        scheduledTime: localTimeToIso(rescheduleValue, timezone),
      });
    } catch {
      return;
    }
  };

  if (!authLoading && !isTutor) {
    return (
      <section
        className="focus-card p-8 text-center"
        data-testid="tutor-bookings-forbidden"
      >
        <h2 className="text-xl font-bold text-[var(--ink)]">
          {t("هذه المساحة للمعلمين فقط", "This area is for tutors only")}
        </h2>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          {t(
            "سجّل الدخول بحساب معلم لعرض الحجوزات.",
            "Sign in with a tutor account to view bookings.",
          )}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5" aria-labelledby="tutor-bookings-title">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--signal-strong)]">
            {t("جدول مباشر", "Live schedule")}
          </p>
          <h2
            id="tutor-bookings-title"
            className="mt-1 text-2xl font-bold text-[var(--ink)]"
          >
            {title ?? t("حجوزات الطلاب", "Student bookings")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--ink-muted)]">
            {description ??
              t(
                "تتزامن الحجوزات تلقائياً كل 10 ثوانٍ وتُعرض بتوقيت كل درس.",
                "Bookings sync automatically every 10 seconds and display in each lesson’s timezone.",
              )}
          </p>
        </div>
        {lessonsQuery.isFetching && !lessonsQuery.isLoading && (
          <span
            className="flex items-center gap-2 text-xs font-medium text-[var(--ink-muted)]"
            role="status"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--success)]" />
            {t("جارٍ التحديث", "Syncing")}
          </span>
        )}
      </header>

      <div
        className="flex gap-1 border-b border-[var(--border)]"
        role="tablist"
        aria-label={t("تصفية الحجوزات", "Filter bookings")}
      >
        {(
          [
            ["upcoming", t("قادمة", "Upcoming"), upcoming.length],
            ["history", t("السجل", "History"), history.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            id={`tutor-bookings-${key}-tab`}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            aria-controls={`tutor-bookings-${key}-panel`}
            onClick={() => setActiveTab(key)}
            className="relative min-h-11 px-4 py-2 text-sm font-semibold transition-colors"
            style={{
              color: activeTab === key ? "var(--ink)" : "var(--ink-muted)",
            }}
          >
            {label}{" "}
            <span
              className="ms-1 inline-flex min-w-6 justify-center rounded-md px-1.5 py-0.5 text-xs"
              style={{
                background:
                  activeTab === key
                    ? "var(--signal-soft)"
                    : "var(--canvas-sunken)",
              }}
            >
              {count}
            </span>
            {activeTab === key && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--signal)]" />
            )}
          </button>
        ))}
      </div>

      <div aria-live="polite">
        {notice && (
          <p
            className="mb-4 rounded-lg border px-4 py-3 text-sm font-medium"
            style={{
              background: "var(--success-soft)",
              borderColor:
                "color-mix(in srgb, var(--success) 28%, var(--border))",
              color: "var(--success)",
            }}
            role="status"
          >
            {notice}
          </p>
        )}
      </div>

      <div
        id={`tutor-bookings-${activeTab}-panel`}
        role="tabpanel"
        aria-labelledby={`tutor-bookings-${activeTab}-tab`}
      >
        {lessonsQuery.isLoading || authLoading ? (
          <BookingSkeleton />
        ) : lessonsQuery.isError ? (
          <div
            className="focus-card border-s-4 p-6"
            style={{ borderInlineStartColor: "var(--danger)" }}
            role="alert"
          >
            <h3 className="font-bold text-[var(--ink)]">
              {t("تعذر تحميل الحجوزات", "Bookings could not be loaded")}
            </h3>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              {t(
                "تحقق من الاتصال ثم حاول مرة أخرى.",
                "Check your connection and try again.",
              )}
            </p>
            <button
              type="button"
              className="btn-secondary mt-4"
              onClick={() => lessonsQuery.refetch()}
            >
              {t("إعادة المحاولة", "Try again")}
            </button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="focus-card px-6 py-14 text-center">
            <span
              className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl text-xl font-bold"
              style={{
                background: "var(--signal-soft)",
                color: "var(--signal-strong)",
              }}
              aria-hidden="true"
            >
              {activeTab === "upcoming" ? "○" : "✓"}
            </span>
            <h3 className="mt-4 font-bold text-[var(--ink)]">
              {activeTab === "upcoming"
                ? t("لا توجد حجوزات قادمة", "No upcoming bookings")
                : t("لا يوجد سجل بعد", "No booking history yet")}
            </h3>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              {activeTab === "upcoming"
                ? t(
                    "سيظهر الحجز هنا فور تأكيده.",
                    "A booking will appear here as soon as it is confirmed.",
                  )
                : t(
                    "ستظهر الدروس المكتملة والملغاة هنا.",
                    "Completed and cancelled lessons will appear here.",
                  )}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((lesson) => (
              <BookingCard
                key={lesson.id}
                lesson={lesson}
                locale={locale}
                lang={lang}
                onReschedule={openReschedule}
                onCancel={(selected) => {
                  cancel.reset();
                  setNotice("");
                  setCancelLesson(selected);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {rescheduleLesson && (
        <DialogFrame
          titleId="reschedule-booking-title"
          onClose={() => {
            if (!reschedule.isPending) setRescheduleLesson(null);
          }}
        >
          <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div>
              <h3
                id="reschedule-booking-title"
                className="text-lg font-bold text-[var(--ink)]"
              >
                {t("إعادة جدولة الدرس", "Reschedule lesson")}
              </h3>
              <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
                {rescheduleLesson.student.firstName}{" "}
                {rescheduleLesson.student.lastName}
              </p>
            </div>
            <CloseButton
              label={t("إغلاق", "Close")}
              onClick={() => setRescheduleLesson(null)}
              disabled={reschedule.isPending}
            />
          </header>
          <form onSubmit={submitReschedule}>
            <div className="space-y-4 p-5">
              <label className="block text-sm font-semibold text-[var(--ink)]">
                {t("الموعد الجديد", "New date and time")}
                <input
                  className="input-field mt-2"
                  type="datetime-local"
                  value={rescheduleValue}
                  onChange={(event) => setRescheduleValue(event.target.value)}
                  required
                  data-testid="reschedule-datetime"
                />
              </label>
              <p className="text-sm text-[var(--ink-muted)]">
                {t("التوقيت المستخدم:", "Displayed timezone:")}{" "}
                <strong dir="ltr">
                  {rescheduleLesson.timezone || user?.timezone || "UTC"}
                </strong>
              </p>
              {reschedule.isError && (
                <p className="text-sm text-[var(--danger)]" role="alert">
                  {errorMessage(
                    reschedule.error,
                    t(
                      "تعذر تحديث موعد الدرس.",
                      "The lesson time could not be updated.",
                    ),
                  )}
                </p>
              )}
            </div>
            <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setRescheduleLesson(null)}
                disabled={reschedule.isPending}
              >
                {t("رجوع", "Back")}
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={!rescheduleValue || reschedule.isPending}
                data-testid="confirm-reschedule"
              >
                {reschedule.isPending
                  ? t("جارٍ الحفظ…", "Saving…")
                  : t("حفظ الموعد", "Save new time")}
              </button>
            </footer>
          </form>
        </DialogFrame>
      )}

      {cancelLesson && (
        <DialogFrame
          titleId="cancel-booking-title"
          onClose={() => {
            if (!cancel.isPending) setCancelLesson(null);
          }}
        >
          <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <h3
              id="cancel-booking-title"
              className="text-lg font-bold text-[var(--ink)]"
            >
              {t("إلغاء هذا الدرس؟", "Cancel this lesson?")}
            </h3>
            <CloseButton
              label={t("إغلاق", "Close")}
              onClick={() => setCancelLesson(null)}
              disabled={cancel.isPending}
            />
          </header>
          <div className="p-5">
            <p className="text-[var(--ink)]">
              {t(
                `سيُلغى درس ${cancelLesson.student.firstName} ${cancelLesson.student.lastName} نهائياً.`,
                `The lesson with ${cancelLesson.student.firstName} ${cancelLesson.student.lastName} will be cancelled.`,
              )}
            </p>
            <p
              className="mt-4 rounded-lg border px-4 py-3 text-sm font-semibold"
              style={{
                background: "var(--danger-soft)",
                borderColor:
                  "color-mix(in srgb, var(--danger) 28%, var(--border))",
                color: "var(--danger)",
              }}
            >
              {t(
                "سيُعاد المبلغ كاملاً إلى رصيد الطالب.",
                "The student will receive a full refund.",
              )}
            </p>
            {cancel.isError && (
              <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
                {errorMessage(
                  cancel.error,
                  t("تعذر إلغاء الدرس.", "The lesson could not be cancelled."),
                )}
              </p>
            )}
          </div>
          <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setCancelLesson(null)}
              disabled={cancel.isPending}
            >
              {t("الاحتفاظ بالدرس", "Keep lesson")}
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => cancel.mutate(cancelLesson.id)}
              disabled={cancel.isPending}
              data-testid="confirm-cancel"
            >
              {cancel.isPending
                ? t("جارٍ الإلغاء…", "Cancelling…")
                : t("إلغاء وردّ المبلغ", "Cancel & refund")}
            </button>
          </footer>
        </DialogFrame>
      )}
    </section>
  );
}
