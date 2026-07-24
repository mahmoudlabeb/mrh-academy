"use client";

import { isAxiosError } from "axios";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import { apiClient } from "@/lib/api-client";
import styles from "./TutorProfile.module.css";

function getErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    const responseMessage = error.response?.data?.message;
    if (typeof responseMessage === "string") return responseMessage;
    if (Array.isArray(responseMessage)) return responseMessage.join(" ");
  }
  return fallback;
}

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
  const queryClient = useQueryClient();
  const isAr = lang === "ar";
  const t = (ar: string, en: string) => (isAr ? ar : en);

  const favoritesQuery = useQuery({
    queryKey: ["favorite-tutors"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ userId: string }[]>(
        "/students/favorite-tutors",
      );
      return data;
    },
    enabled: user?.role === "student",
    staleTime: 30_000,
  });

  const isFavorite = (favoritesQuery.data ?? []).some(
    (favorite) => favorite.userId === tutorId,
  );

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      if (isFavorite) {
        await apiClient.delete(`/students/favorites/${tutorId}`);
      } else {
        await apiClient.post("/students/favorites", { tutorId });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["favorite-tutors"] });
    },
  });

  const messagePath = `/student?tab=messages&with=${encodeURIComponent(tutorId)}`;

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

  const handleFavorite = () => {
    if (requireStudent(window.location.pathname)) favoriteMutation.mutate();
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
  const favoriteError = favoriteMutation.isError
    ? getErrorMessage(
        favoriteMutation.error,
        t(
          "تعذر تحديث المفضلة. يرجى المحاولة مرة أخرى.",
          "Could not update favorites. Please try again.",
        ),
      )
    : null;

  return (
    <div className={styles.actionsWrap}>
      <div className={styles.actions}>
        <Link
          href={`/book-lesson?tutorId=${tutorId}`}
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
          onClick={handleFavorite}
          disabled={
            isLoading || favoritesQuery.isLoading || favoriteMutation.isPending
          }
          aria-pressed={isFavorite}
          className={styles.secondaryAction}
        >
          <svg
            viewBox="0 0 24 24"
            fill={isFavorite ? "currentColor" : "none"}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.7}
            />
          </svg>
          {favoriteMutation.isPending
            ? t("جارٍ الحفظ…", "Saving…")
            : isFavorite
              ? t("محفوظ في المفضلة", "Saved to favorites")
              : t("أضف للمفضلة", "Add to favorites")}
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

      {(roleError || favoriteError) && (
        <p className={styles.actionError} role="alert">
          {roleError || favoriteError}
        </p>
      )}
    </div>
  );
}
