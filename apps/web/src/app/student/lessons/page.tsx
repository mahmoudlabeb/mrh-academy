"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LessonStatus } from "@mrh/types";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";

type Lesson = {
  id: string;
  status: LessonStatus;
  date: string;
  duration: number;
  price: number;
  meetUrl: string;
  googleMeetUrl: string | null;
  tutorName: string;
};

export default function StudentLessonsPage() {
  const { lang } = useLanguage();
  const [activeTab, setActiveTab] = useState<"upcoming" | "pending" | "past">(
    "upcoming",
  );
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const { data: lessons = [], isLoading } = useQuery<Lesson[]>({
    queryKey: ["student-lessons-page"],
    queryFn: async () =>
      (await apiClient.get<Lesson[]>("/students/lessons")).data,
  });

  const upcomingLessons = lessons.filter(
    (lesson) => lesson.status === LessonStatus.CONFIRMED,
  );
  const pendingLessons = lessons.filter(
    (lesson) => lesson.status === LessonStatus.PENDING,
  );
  const pastLessons = lessons.filter(
    (lesson) =>
      lesson.status === LessonStatus.COMPLETED ||
      lesson.status === LessonStatus.CANCELLED,
  );
  const tabLessons =
    activeTab === "upcoming"
      ? upcomingLessons
      : activeTab === "pending"
        ? pendingLessons
        : pastLessons;

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-64"
        role="status"
        aria-label={t("جاري تحميل الدروس", "Loading lessons")}
      >
        <div className="w-8 h-8 border-2 border-[#D4A353] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1
        className="text-2xl font-bold mb-6"
        style={{ color: "var(--text-main)" }}
      >
        {t("دروسي", "My Lessons")}
      </h1>

      <div
        className="flex gap-2 mb-6"
        role="tablist"
        aria-label={t("أقسام الدروس", "Lesson sections")}
      >
        {[
          {
            key: "upcoming" as const,
            label: `${t("قادمة", "Upcoming")} (${upcomingLessons.length})`,
          },
          {
            key: "pending" as const,
            label: `${t("بانتظار القبول", "Pending")} (${pendingLessons.length})`,
          },
          {
            key: "past" as const,
            label: `${t("سابقة", "Past")} (${pastLessons.length})`,
          },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={
              activeTab === tab.key
                ? {
                    background: "linear-gradient(135deg, #F3E1B9, #B89754)",
                    color: "#0F3A40",
                  }
                : { background: "var(--bg-light)", color: "var(--text-muted)" }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabLessons.length === 0 ? (
        <div
          className="text-center py-16"
          style={{ color: "var(--text-muted)" }}
        >
          {activeTab === "upcoming" ? (
            <>
              {t("لا توجد دروس قادمة.", "No upcoming lessons.")}{" "}
              <Link href="/student/discover" className="link">
                {t("احجز أول درس لك", "Book your first lesson")}
              </Link>
            </>
          ) : (
            t("لا توجد دروس في هذا القسم", "No lessons in this section")
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {tabLessons.map((lesson) => (
            <article
              key={lesson.id}
              className="card-gold p-6 flex flex-col sm:flex-row sm:items-center gap-4"
              data-testid="lesson-card"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                  style={{ background: "#D4A353" }}
                  aria-hidden="true"
                >
                  {lesson.tutorName?.trim()?.[0] || "T"}
                </span>
                <div className="min-w-0">
                  <h2
                    className="font-semibold truncate"
                    style={{ color: "var(--text-main)" }}
                  >
                    {lesson.tutorName || t("معلم", "Tutor")}
                  </h2>
                  <p
                    className="text-sm truncate"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {new Date(lesson.date).toLocaleString(
                      lang === "ar" ? "ar-EG" : "en-US",
                    )}{" "}
                    · {lesson.duration} {t("دقيقة", "min")} · ${lesson.price}
                  </p>
                </div>
              </div>

              {lesson.status === LessonStatus.CONFIRMED && (
                <div className="flex gap-2 shrink-0">
                  <Link
                    href={`/classroom/${lesson.meetUrl}`}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-center"
                    style={{
                      background: "linear-gradient(135deg, #F3E1B9, #B89754)",
                      color: "#0F3A40",
                    }}
                  >
                    {t("دخول الفصل", "Join Classroom")}
                  </Link>
                  {lesson.googleMeetUrl && (
                    <a
                      href={lesson.googleMeetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg text-sm font-semibold text-center"
                      style={{
                        background: "var(--bg-light)",
                        color: "var(--text-muted)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      {lesson.googleMeetUrl.includes("meet.jit.si")
                        ? "Jitsi Meet"
                        : "Google Meet"}
                    </a>
                  )}
                </div>
              )}

              {lesson.status === LessonStatus.PENDING && (
                <StatusBadge color="#eab308">
                  {t("بانتظار القبول", "Awaiting Approval")}
                </StatusBadge>
              )}
              {lesson.status === LessonStatus.COMPLETED && (
                <StatusBadge color="#22c55e">
                  {t("مكتمل", "Completed")}
                </StatusBadge>
              )}
              {lesson.status === LessonStatus.CANCELLED && (
                <StatusBadge color="#ef4444">
                  {t("ملغي", "Cancelled")}
                </StatusBadge>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

function StatusBadge({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className="badge text-sm shrink-0"
      style={{
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}
