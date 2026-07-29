"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import {
  normalizeCollection,
  type CollectionResponse,
} from "@/lib/api-collection";

type Lesson = {
  id: string;
  status: string;
  scheduledTime?: string;
  date?: string;
  durationMinutes?: number;
  duration?: number;
  price: number;
  roomId?: string;
  meetUrl?: string;
  googleMeetUrl?: string | null;
  tutorName?: string;
  studentName?: string;
  tutor?: { firstName?: string; lastName?: string };
  student?: { firstName?: string; lastName?: string };
};

export default function LessonDetailRoute() {
  const params = useParams<{ lessonId: string }>();
  const { user } = useAuth();
  const { lang } = useLanguage();
  const isStudent = user?.role === "student";
  const [reportOpen, setReportOpen] = useState(false);
  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");
  const lessons = useQuery({
    queryKey: ["lesson-record", params.lessonId, user?.role],
    queryFn: async () => {
      const endpoint = isStudent ? "/students/lessons" : "/lessons";
      const { data } = await apiClient.get<CollectionResponse<Lesson>>(
        endpoint,
        { params: { page: 1, limit: 50 } },
      );
      const records = normalizeCollection(data);
      return records.find((lesson) => lesson.id === params.lessonId) ?? null;
    },
    enabled: Boolean(user),
  });
  const lesson = lessons.data;
  const scheduled = lesson?.scheduledTime ?? lesson?.date;
  const room = lesson?.roomId ?? lesson?.meetUrl;
  const tutorName =
    lesson?.tutorName ??
    [lesson?.tutor?.firstName, lesson?.tutor?.lastName]
      .filter(Boolean)
      .join(" ");
  const studentName =
    lesson?.studentName ??
    [lesson?.student?.firstName, lesson?.student?.lastName]
      .filter(Boolean)
      .join(" ");
  const report = useMutation({
    mutationFn: async () =>
      apiClient.post("/reports", {
        lessonId: params.lessonId,
        issueType: issueType.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      setIssueType("");
      setDescription("");
      setReportOpen(false);
    },
  });

  if (lessons.isLoading) {
    return (
      <main className="focus-page">
        <div className="focus-skeleton" />
      </main>
    );
  }
  if (lessons.isError || !lesson) {
    return (
      <main
        className="focus-page focus-empty"
        role={lessons.isError ? "alert" : undefined}
      >
        <h1>
          {lang === "ar" ? "تعذر فتح سجل الدرس" : "Lesson record unavailable"}
        </h1>
        <p>
          {lang === "ar"
            ? "قد لا تملك صلاحية هذا الدرس أو لم يعد موجودًا."
            : "The lesson may not exist or may not belong to your account."}
        </p>
        {lessons.isError && (
          <button
            className="btn-secondary"
            type="button"
            onClick={() => lessons.refetch()}
          >
            {lang === "ar" ? "إعادة المحاولة" : "Retry"}
          </button>
        )}
      </main>
    );
  }

  return (
    <main className="focus-page lesson-record">
      <header className="focus-page-header">
        <div>
          <p className="focus-eyebrow">
            {lang === "ar" ? "سجل درس مشترك" : "Shared lesson record"}
          </p>
          <h1>
            {lang === "ar" ? "تفاصيل الدرس المباشر" : "Live Lesson Detail"}
          </h1>
        </div>
        <span className={`badge badge-${lesson.status.toLowerCase()}`}>
          {lesson.status}
        </span>
      </header>
      <section className="focus-panel lesson-record-summary">
        <dl>
          <div>
            <dt>{lang === "ar" ? "المعلّم" : "Tutor"}</dt>
            <dd>{tutorName || "—"}</dd>
          </div>
          <div>
            <dt>{lang === "ar" ? "الطالب" : "Learner"}</dt>
            <dd>{studentName || "—"}</dd>
          </div>
          <div>
            <dt>{lang === "ar" ? "الموعد" : "Scheduled time"}</dt>
            <dd>
              {scheduled
                ? new Date(scheduled).toLocaleString(
                    lang === "ar" ? "ar-EG" : "en-US",
                  )
                : "—"}
            </dd>
          </div>
          <div>
            <dt>{lang === "ar" ? "المدة" : "Duration"}</dt>
            <dd>{lesson.durationMinutes ?? lesson.duration ?? "—"} min</dd>
          </div>
          <div>
            <dt>{lang === "ar" ? "رسوم الدرس" : "Lesson fee"}</dt>
            <dd>${Number(lesson.price).toFixed(2)}</dd>
          </div>
        </dl>
      </section>
      <section className="focus-panel lesson-actions">
        <h2>{lang === "ar" ? "الإجراءات المتاحة" : "Available actions"}</h2>
        <div>
          {room && lesson.status.toLowerCase() === "confirmed" && (
            <Link className="btn-primary" href={`/${lang}/room/${room}`}>
              {lang === "ar" ? "دخول فصل MRH" : "Join MRH Classroom"}
            </Link>
          )}
          <Link className="btn-secondary" href={`/${lang}/messages`}>
            {lang === "ar" ? "إرسال رسالة" : "Message"}
          </Link>
          {lesson.googleMeetUrl && (
            <a
              className="btn-outline-signal"
              href={lesson.googleMeetUrl}
              target="_blank"
              rel="noreferrer"
            >
              {lang === "ar"
                ? "Google Meet (احتياطي)"
                : "Google Meet (fallback)"}
            </a>
          )}
          {lesson.status.toLowerCase() === "completed" && (
            <button
              className="btn-danger"
              type="button"
              aria-expanded={reportOpen}
              aria-controls="lesson-report-form"
              onClick={() => {
                report.reset();
                setReportOpen((open) => !open);
              }}
            >
              {lang === "ar"
                ? "الإبلاغ عن مشكلة في الدرس"
                : "Report a lesson issue"}
            </button>
          )}
        </div>
        {reportOpen && (
          <form
            id="lesson-report-form"
            className="blueprint-panel-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (issueType.trim()) report.mutate();
            }}
          >
            <label>
              {lang === "ar" ? "نوع المشكلة" : "Issue type"}
              <input
                required
                maxLength={100}
                value={issueType}
                onChange={(event) => setIssueType(event.target.value)}
              />
            </label>
            <label>
              {lang === "ar" ? "التفاصيل" : "Details"}
              <textarea
                maxLength={2000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            {report.isError && (
              <p className="blueprint-error" role="alert">
                {lang === "ar"
                  ? "تعذر إرسال البلاغ. حاول مرة أخرى."
                  : "The report could not be submitted. Please try again."}
              </p>
            )}
            <button
              className="btn-primary"
              type="submit"
              disabled={report.isPending}
            >
              {report.isPending
                ? lang === "ar"
                  ? "جارٍ الإرسال…"
                  : "Submitting…"
                : lang === "ar"
                  ? "إرسال البلاغ"
                  : "Submit report"}
            </button>
          </form>
        )}
        {report.isSuccess && (
          <p
            className="blueprint-status blueprint-status--completed"
            role="status"
          >
            {lang === "ar"
              ? "تم إرسال البلاغ للمراجعة."
              : "Your report was submitted for review."}
          </p>
        )}
      </section>
    </main>
  );
}
