"use client";

import { TutorBookings } from "@/components/tutor/TutorBookings";
import { useLanguage } from "@/contexts/language-context";

export default function TutorLessonsPage() {
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--signal-strong)]">
          {t("مركز التدريس", "Teaching control center")}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-[var(--ink)]">
          {t("دروسي", "My Lessons")}
        </h1>
      </header>
      <TutorBookings />
    </main>
  );
}
