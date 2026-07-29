"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";
import { WorkspaceSection } from "@/components/shared/WorkspaceSection";

type Enrollment = {
  id: string;
  courseId: string;
  progressPercentage: number;
  course: {
    id: string;
    title: string;
    description: string;
    thumbnailUrl?: string | null;
    tutor?: { firstName?: string; lastName?: string };
  };
};

export default function LearnerCoursesRoute() {
  const { lang } = useLanguage();
  const enrollments = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () =>
      (await apiClient.get<Enrollment[]>("/courses/my/enrollments")).data,
  });
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);

  return (
    <WorkspaceSection
      eyebrow={t("مكتبة التعلّم", "Learning library")}
      title={t("دوراتي المسجّلة", "My Enrolled Courses")}
      description={t(
        "تقدّمك محفوظ من الخادم لكل دورة.",
        "Server-recorded progress for every enrolled course.",
      )}
    >
      {enrollments.isLoading ? (
        <div
          className="focus-skeleton"
          aria-label={t("جارٍ تحميل الدورات", "Loading courses")}
        />
      ) : enrollments.isError ? (
        <section className="focus-empty" role="alert">
          <h2>{t("تعذر تحميل مكتبة الدورات", "Course library unavailable")}</h2>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => enrollments.refetch()}
          >
            {t("إعادة المحاولة", "Retry")}
          </button>
        </section>
      ) : !enrollments.data?.length ? (
        <section className="focus-empty">
          <h2>{t("لا توجد دورات مسجّلة بعد", "No enrolled courses yet")}</h2>
          <Link className="btn-primary" href={`/${lang}/courses`}>
            {t("تصفّح دليل الدورات", "Browse Course Catalog")}
          </Link>
        </section>
      ) : (
        <div className="enrollment-grid">
          {enrollments.data.map((enrollment) => (
            <article className="enrollment-card" key={enrollment.id}>
              <div className="enrollment-cover">
                {enrollment.course.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={enrollment.course.thumbnailUrl} alt="" />
                ) : (
                  <span aria-hidden="true">MRH</span>
                )}
              </div>
              <div className="enrollment-body">
                <h2>{enrollment.course.title}</h2>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={enrollment.progressPercentage}
                >
                  <span
                    style={{
                      inlineSize: `${Math.min(100, Math.max(0, enrollment.progressPercentage))}%`,
                    }}
                  />
                </div>
                <p>
                  {enrollment.progressPercentage}% {t("مكتمل", "completed")}
                </p>
                <Link
                  className="btn-primary"
                  href={`/${lang}/learn/courses/${enrollment.courseId}`}
                >
                  {t("متابعة التعلّم", "Continue Learning")}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </WorkspaceSection>
  );
}
