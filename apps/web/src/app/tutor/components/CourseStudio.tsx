"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";
import { CourseStudioEditor } from "./CourseStudioEditor";
import styles from "./CourseStudio.module.css";

type ProductStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "rejected"
  | "archived";

type Course = {
  id: string;
  title: string;
  subtitle?: string | null;
  description: string;
  thumbnailUrl: string | null;
  price: number;
  status: ProductStatus;
  courseType?: "recorded" | "live";
  updatedAt?: string;
  submittedAt?: string | null;
  reviewNote?: string | null;
};

type Filter = "all" | "drafts" | "review" | "active" | "rejected";

function statusLabel(course: Course, t: (ar: string, en: string) => string) {
  if (course.status === "draft") return t("مسودة", "Draft");
  if (course.status === "active") return t("نشط", "Active");
  if (course.status === "rejected")
    return t("يحتاج تعديلات", "Changes needed");
  if (course.status === "archived") return t("مؤرشف", "Archived");
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
    drafts: courses.filter((course) => course.status === "draft").length,
    review: courses.filter((course) => course.status === "pending_review")
      .length,
    active: courses.filter((course) => course.status === "active").length,
    rejected: courses.filter((course) => course.status === "rejected").length,
  };
  const visibleCourses = courses.filter((course) => {
    if (filter === "drafts") return course.status === "draft";
    if (filter === "review") return course.status === "pending_review";
    if (filter === "active") return course.status === "active";
    if (filter === "rejected") return course.status === "rejected";
    return course.status !== "archived";
  });

  return (
    <section className={styles.manager} aria-labelledby="course-manager-title">
      <header className={styles.managerHeader}>
        <div>
          <span className={styles.eyebrow}>
            {t("استوديو المدرّس", "Instructor studio")}
          </span>
          <h1 id="course-manager-title">
            {t("منتجاتك التعليمية", "Your learning products")}
          </h1>
          <p>
            {t(
              "أنشئ الدورات المسجلة والعروض المباشرة، وتابعها بوضوح من المسودة حتى الاعتماد والنشر.",
              "Create recorded courses and live offerings, then track each one clearly from draft to approval and publication.",
            )}
          </p>
        </div>
        <Link
          href={`/${lang}/teach/courses/new/studio`}
          className="btn-primary"
        >
          <Icon name="plus" />
          {t("منتج تعليمي جديد", "New learning product")}
        </Link>
      </header>

      <div
        className={styles.metrics}
        aria-label={t("ملخص المنتجات", "Product summary")}
      >
        <Metric label={t("كل المنتجات", "All products")} value={courses.length} />
        <Metric label={t("المسودات", "Drafts")} value={counts.drafts} />
        <Metric label={t("قيد المراجعة", "In review")} value={counts.review} />
        <Metric label={t("النشطة", "Active")} value={counts.active} />
        <Metric
          label={t("تحتاج تعديلات", "Rejected")}
          value={counts.rejected}
        />
      </div>

      <div
        className={styles.filters}
        role="group"
        aria-label={t("تصفية المنتجات", "Filter products")}
      >
        {(
          [
            ["all", t("الكل", "All"), courses.length],
            ["drafts", t("المسودات", "Drafts"), counts.drafts],
            ["review", t("قيد المراجعة", "In review"), counts.review],
            ["active", t("النشطة", "Active"), counts.active],
            ["rejected", t("تحتاج تعديلات", "Rejected"), counts.rejected],
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
          aria-label={t("جاري تحميل المنتجات", "Loading products")}
        >
          {[0, 1, 2].map((item) => (
            <div key={item} className={`${styles.courseSkeleton} skeleton`} />
          ))}
        </div>
      ) : coursesQuery.isError ? (
        <div className={styles.emptyState} role="alert">
          <strong>
            {t("تعذّر تحميل المنتجات", "Products could not be loaded")}
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
              ? t("أنشئ منتجك التعليمي الأول", "Create your first learning product")
              : t("لا توجد منتجات ضمن هذا التصنيف", "No products match this filter")}
          </strong>
          <p>
            {t(
              "يرشدك الاستوديو خطوة بخطوة حتى يصبح المنتج جاهزاً لمراجعة الأكاديمية.",
              "The studio guides you step by step until the product is ready for academy review.",
            )}
          </p>
          {filter === "all" && (
            <Link
              href={`/${lang}/teach/courses/new/studio`}
              className="btn-primary"
            >
              <Icon name="plus" />
              {t("إنشاء منتج", "Create product")}
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
                  data-status={course.status}
                >
                  {statusLabel(course, t)}
                </span>
              </div>
              <div className={styles.courseBody}>
                <div>
                  <h2>
                    {course.title || t("منتج بلا عنوان", "Untitled product")}
                  </h2>
                  <span className={styles.productType}>
                    {course.courseType === "live"
                      ? t("عرض مباشر قابل للحجز", "Live bookable offering")
                      : t("دورة مسجلة", "Recorded course")}
                  </span>
                  <p>
                    {course.subtitle ||
                      course.description ||
                      t(
                        "أكمل تفاصيل المنتج داخل الاستوديو.",
                        "Complete the product details in the studio.",
                      )}
                  </p>
                </div>
                {course.status === "rejected" && course.reviewNote && (
                  <div className={styles.reviewFeedback} role="note">
                    <strong>
                      {t("ملاحظات فريق المراجعة", "Review feedback")}
                    </strong>
                    <p>{course.reviewNote}</p>
                  </div>
                )}
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
                  {course.status === "draft"
                    ? t("متابعة التحرير", "Continue editing")
                    : course.status === "rejected"
                      ? t("مراجعة الملاحظات والتعديل", "Review feedback and revise")
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
