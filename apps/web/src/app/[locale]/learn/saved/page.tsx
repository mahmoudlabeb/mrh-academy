"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";
import { WorkspaceSection } from "@/components/shared/WorkspaceSection";

type FavoriteTutor = {
  userId: string;
  firstName: string;
  lastName: string;
  specialization: string;
  hourlyRate: number;
  averageRating?: number;
};

export default function SavedTutorsRoute() {
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const favorites = useQuery({
    queryKey: ["favorite-tutors"],
    queryFn: async () =>
      (await apiClient.get<FavoriteTutor[]>("/students/favorite-tutors")).data,
  });
  return (
    <WorkspaceSection
      title={t("المعلّمون المحفوظون", "Saved Tutors")}
      description={t("قائمتك الشخصية للحجز السريع.", "Your personal shortlist for faster booking.")}
    >
      {favorites.isLoading ? (
        <div className="focus-skeleton" />
      ) : favorites.isError ? (
        <section className="focus-empty" role="alert">
          <h2>{t("تعذر تحميل المحفوظات", "Saved tutors unavailable")}</h2>
          <button className="btn-secondary" type="button" onClick={() => favorites.refetch()}>
            {t("إعادة المحاولة", "Retry")}
          </button>
        </section>
      ) : !favorites.data?.length ? (
        <section className="focus-empty">
          <h2>{t("لا يوجد معلّمون محفوظون", "No saved tutors yet")}</h2>
          <Link className="btn-primary" href={`/${lang}/tutors`}>
            {t("ابحث عن معلّم", "Find a tutor")}
          </Link>
        </section>
      ) : (
        <div className="saved-tutor-grid">
          {favorites.data.map((tutor) => (
            <article className="saved-tutor-card" key={tutor.userId}>
              <span className="saved-avatar" aria-hidden="true">
                {tutor.firstName[0]}{tutor.lastName[0]}
              </span>
              <div>
                <h2>{tutor.firstName} {tutor.lastName}</h2>
                <p>{tutor.specialization}</p>
              </div>
              <strong>${Number(tutor.hourlyRate).toFixed(2)} / hr</strong>
              <Link className="btn-primary" href={`/${lang}/tutors/${tutor.userId}/book`}>
                {t("احجز درسًا", "Book Lesson")}
              </Link>
            </article>
          ))}
        </div>
      )}
    </WorkspaceSection>
  );
}
