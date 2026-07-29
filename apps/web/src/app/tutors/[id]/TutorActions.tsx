"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import styles from "./TutorProfile.module.css";

export default function TutorActions({
  tutorId,
  hasAvailability,
}: {
  tutorId: string;
  hasAvailability: boolean;
}) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const t = (ar: string, en: string) => (isAr ? ar : en);

  const messagePath = `/${lang}/learn/messages/${encodeURIComponent(tutorId)}`;

  const requireStudent = (destination: string) => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(destination)}`);
      return false;
    }
    if (user.role !== "student") return false;
    return true;
  };

  const handleSendMessage = () => {
    if (requireStudent(messagePath)) router.push(messagePath);
  };

  const handleAvailability = () => {
    const section = document.getElementById("availability");
    if (!section) return;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => section.focus({ preventScroll: true }), 450);
  };

  const roleError =
    user && user.role !== "student"
      ? t(
          "هذه الإجراءات متاحة لحسابات الطلاب فقط.",
          "These actions are available to student accounts only.",
        )
      : null;
  return (
    <div className={styles.actionsWrap}>
      <div className={styles.actions}>
        <Link
          href={`/${lang}/tutors/${tutorId}/book`}
          className={styles.primaryAction}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              d="M8 3v4m8-4v4M5 10h14M5 5h14v16H5V5z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.7}
            />
          </svg>
          {t("احجز درساً تجريبياً", "Book a trial lesson")}
        </Link>

        <button
          type="button"
          onClick={handleSendMessage}
          disabled={isLoading}
          className={styles.secondaryAction}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              d="M21 12a8 8 0 01-8 8H5l-2 2 .7-4A8 8 0 1121 12z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.7}
            />
          </svg>
          {t("أرسل رسالة", "Send message")}
        </button>

        <button
          type="button"
          onClick={handleAvailability}
          className={styles.secondaryAction}
          title={
            hasAvailability
              ? undefined
              : t("لا توجد مواعيد منشورة حالياً", "No published times yet")
          }
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" strokeWidth={1.7} />
            <path
              d="M12 7v5l3 2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.7}
            />
          </svg>
          {hasAvailability
            ? t("عرض المواعيد", "View availability")
            : t("اسأل عن موعد", "Ask about availability")}
        </button>
      </div>

      {roleError && (
        <p className={styles.actionError} role="alert">
          {roleError}
        </p>
      )}
    </div>
  );
}
