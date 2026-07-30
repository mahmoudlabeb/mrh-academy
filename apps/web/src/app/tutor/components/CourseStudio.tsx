"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";
import { CourseStudioEditor } from "./CourseStudioEditor";
import styles from "./CourseStudio.module.css";

type CourseStatus = "pending" | "approved" | "rejected";

type Course = {
  id: string;
  title: string;
  subtitle?: string | null;
  description: string;
  thumbnailUrl: string | null;
  price: number;
  status: CourseStatus;
  updatedAt?: string;
  isDraft?: boolean;
  submittedAt?: string | null;
};

type Filter = "all" | "drafts" | "review" | "published";

function statusLabel(course: Course, t: (ar: string, en: string) => string) {
  if (course.isDraft) return t("مسودة", "Draft");
  if (course.status === "approved") return t("منشورة", "Published");
  if (course.status === "rejected") return t("تحتاج تعديلات", "Changes needed");
  return t("قيد المراجعة", "In review");
}

function Icon({ name }: { name: "plus" | "edit" | "course" }) {
  if (name === "plus") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  }
  if (name === "edit") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6.5 12 3l8 3.5-8 3.5-8-3.5Z" />
      <path d="M6 9.5V16l6 3 6-3V9.5" />
    </svg>
  );
}

export default function CourseStudio() {
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [filter, setFilter] = useState<Filter>("all");
  const coursesQuery = useQuery({
    queryKey: ["my-courses"],
    queryFn: async () =>
      (await apiClient.get<Course[]>("/courses/my/courses")).data,
  });
  const courses = coursesQuery.data ?? [];
  const counts = {
    drafts: courses.filter((course) => course.isDraft).length,
    review: courses.filter(
      (course) => !course.isDraft && course.status === "pending",
    ).length,
    published: courses.filter(
      (course) => !course.isDraft && course.status === "approved",
    ).length,
  };
  const visibleCourses = courses.filter((course) => {
    if (filter === "drafts") return course.isDraft;
    if (filter === "review")
      return !course.isDraft && course.status === "pending";
    if (filter === "published")
      return !course.isDraft && course.status === "approved";
    return true;
  });

  return (
    <section className={styles.manager} aria-labelledby="course-manager-title">
      <header className={styles.managerHeader}>
        <div>
          <span className={styles.eyebrow}>
            {t("استوديو المدرّس", "Instructor studio")}
          </span>
          <h1 id="course-manager-title">
            {t("دوراتك التعليمية", "Your courses")}
          </h1>
          <p>
            {t(
              "أنشئ دورات احترافية، وتابع كل مسودة من مكان واحد.",
              "Create content, track publishing readiness, and manage the student experience in one place.",
            )}
          </p>
        </div>
        <Link
          href={`/${lang}/teach/courses/new/studio`}
          className="btn-primary"
        >
          <Icon name="plus" />
          {t("دورة جديدة", "New course")}
        </Link>
      </header>

      <div
        className={styles.metrics}
        aria-label={t("ملخص الدورات", "Course summary")}
      >
        <Metric label={t("كل الدورات", "All courses")} value={courses.length} />
        <Metric label={t("المسودات", "Drafts")} value={counts.drafts} />
        <Metric label={t("قيد المراجعة", "In review")} value={counts.review} />
        <Metric label={t("المنشورة", "Published")} value={counts.published} />
      </div>

      <div
        className={styles.filters}
        role="group"
        aria-label={t("تصفية الدورات", "Filter courses")}
      >
        {(
          [
            ["all", t("الكل", "All"), courses.length],
            ["drafts", t("المسودات", "Drafts"), counts.drafts],
            ["review", t("قيد المراجعة", "In review"), counts.review],
            ["published", t("المنشورة", "Published"), counts.published],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            className={filter === id ? styles.activeFilter : undefined}
            onClick={() => setFilter(id)}
          >
            {label}
            <span>{count}</span>
          </button>
        ))}
      </div>

      {coursesQuery.isLoading ? (
        <div
          className={styles.courseGrid}
          aria-label={t("جارٍ تحميل الدورات", "Loading courses")}
        >
          {[0, 1, 2].map((item) => (
            <div key={item} className={`${styles.courseSkeleton} skeleton`} />
          ))}
        </div>
      ) : coursesQuery.isError ? (
        <div className={styles.emptyState} role="alert">
          <strong>
            {t("تعذّر تحميل الدورات", "Courses could not be loaded")}
          </strong>
          <p>
            {t(
              "تحقق من الاتصال ثم حاول مرة أخرى.",
              "Check your connection and try again.",
            )}
          </p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => coursesQuery.refetch()}
          >
            {t("إعادة المحاولة", "Try again")}
          </button>
        </div>
      ) : visibleCourses.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>
            <Icon name="course" />
          </span>
          <strong>
            {filter === "all"
              ? t("أنشئ دورتك الأولى", "Create your first course")
              : t(
                  "لا توجد دورات ضمن هذا التصنيف",
                  "No courses match this filter",
                )}
          </strong>
          <p>
            {t(
              "ابدأ بمسودة جديدة وابنِ تجربة تعلم متكاملة واحترافية.",
              "The studio guides you step by step until your course is ready for review.",
            )}
          </p>
          {filter === "all" && (
            <Link
              href={`/${lang}/teach/courses/new/studio`}
              className="btn-primary"
            >
              <Icon name="plus" />
              {t("إنشاء دورة", "Create course")}
            </Link>
          )}
        </div>
      ) : (
        <div className={styles.courseGrid}>
          {visibleCourses.map((course) => (
            <article className={styles.courseCard} key={course.id}>
              <div className={styles.courseCover}>
                {course.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={course.thumbnailUrl} alt="" />
                ) : (
                  <div className={styles.coverPlaceholder}>
                    <Icon name="course" />
                    <span>MRH Academy</span>
                  </div>
                )}
                <span
                  className={styles.statusBadge}
                  data-status={
                    course.isDraft
                      ? "draft"
                      : course.status === "approved"
                        ? "published"
                        : course.status
                  }
                >
                  {statusLabel(course, t)}
                </span>
              </div>
              <div className={styles.courseBody}>
                <div>
                  <h2>
                    {course.title || t("دورة بلا عنوان", "Untitled course")}
                  </h2>
                  <p>
                    {course.subtitle ||
                      course.description ||
                      t(
                        "أكمل تفاصيل الدورة داخل الاستوديو.",
                        "Complete the course details in the studio.",
                      )}
                  </p>
                </div>
                <div className={styles.courseMeta}>
                  <span>
                    {course.updatedAt
                      ? t(
                          `آخر تحديث ${new Date(course.updatedAt).toLocaleDateString("ar-EG")}`,
                          `Updated ${new Date(course.updatedAt).toLocaleDateString("en-US")}`,
                        )
                      : t("مسودة جديدة", "New draft")}
                  </span>
                  <strong>${Number(course.price || 0).toFixed(2)}</strong>
                </div>
                <Link
                  href={`/${lang}/teach/courses/${course.id}/studio`}
                  className="btn-secondary"
                >
                  <Icon name="edit" />
                  {course.isDraft
                    ? t("متابعة التحرير", "Continue editing")
                    : t("عرض التفاصيل", "View details")}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export { CourseStudioEditor };
