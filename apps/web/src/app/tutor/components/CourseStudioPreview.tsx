"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";
import { SecureVideoPlayer } from "@/components/shared/SecureVideoPlayer";
import styles from "./CourseStudio.module.css";

type StudioPreview = {
  course: {
    id: string;
    tutorId: string;
    title: string;
    subtitle: string | null;
    description: string;
    category: string | null;
    language: string;
    level: string;
    price: number;
    thumbnailUrl: string | null;
    learningOutcomes: string[] | null;
    requirements: string[] | null;
    targetAudience: string[] | null;
  };
  sections: Array<{
    id: string;
    title: string;
    description: string | null;
    sectionOrder: number;
  }>;
  lessons: Array<{
    id: string;
    sectionId: string | null;
    title: string;
    description: string | null;
    durationMinutes: number;
    lessonOrder: number;
    contentType: "video" | "article" | "resource";
    downloadableFiles?: Array<{ id: string; name: string }>;
    externalLinks?: Array<{ title: string; url: string }>;
    isPreview: boolean;
  }>;
};

type TutorProfile = {
  bio?: string;
  specialization?: string;
  experienceYears?: number | null;
  user?: {
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  };
};

function PreviewIcon({
  name,
}: {
  name: "back" | "check" | "play" | "file" | "link" | "clock";
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {name === "back" && <path d="m15 18-6-6 6-6" />}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
      {name === "play" && <path d="m9 7 8 5-8 5V7Z" />}
      {name === "file" && (
        <>
          <path d="M6 3h8l4 4v14H6V3Z" />
          <path d="M14 3v5h4" />
        </>
      )}
      {name === "link" && (
        <>
          <path d="m10 13 4-4" />
          <path d="M8.5 16.5 6 19a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0" />
          <path d="m15.5 7.5 2.5-2.5a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0" />
        </>
      )}
      {name === "clock" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      )}
    </svg>
  );
}

export default function CourseStudioPreview() {
  const params = useParams<{ id: string }>();
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const studioQuery = useQuery({
    queryKey: ["course-studio-preview", params.id],
    queryFn: async () =>
      (await apiClient.get<StudioPreview>(`/courses/${params.id}/studio`)).data,
  });
  const profileQuery = useQuery({
    queryKey: ["tutor-preview-profile"],
    queryFn: async () =>
      (await apiClient.get<TutorProfile>("/tutors/me/profile")).data,
  });

  if (studioQuery.isLoading) {
    return <div className={`${styles.previewLoading} skeleton`} />;
  }
  if (!studioQuery.data) {
    return (
      <section className={styles.studioError} role="alert">
        <strong>
          {t("تعذّر تحميل المعاينة", "Preview could not be loaded")}
        </strong>
        <Link
          href={`/${lang}/teach/courses/${params.id}/studio`}
          className="btn-secondary"
        >
          {t("العودة إلى الاستوديو", "Back to studio")}
        </Link>
      </section>
    );
  }

  const { course, sections, lessons } = studioQuery.data;
  const tutor = profileQuery.data;
  const duration = lessons.reduce(
    (total, lesson) => total + lesson.durationMinutes,
    0,
  );
  const resourceCount = lessons.reduce(
    (total, lesson) =>
      total +
      (lesson.downloadableFiles?.length ?? 0) +
      (lesson.externalLinks?.length ?? 0),
    0,
  );

  return (
    <div className={styles.previewPage} data-testid="course-student-preview">
      <div className={styles.previewModeBar}>
        <div>
          <span>{t("وضع المعاينة", "Preview mode")}</span>
          <strong>
            {t(
              "هذا ما يراه الطلاب قبل الشراء",
              "This is what students see before purchase",
            )}
          </strong>
        </div>
        <Link
          href={`/${lang}/teach/courses/${params.id}/studio`}
          className="btn-secondary"
        >
          <PreviewIcon name="back" />
          {t("العودة إلى التحرير", "Back to editing")}
        </Link>
      </div>

      <section className={styles.previewHero}>
        <div className={styles.previewHeroCopy}>
          <div className={styles.previewPills}>
            <span>{course.category || t("دورة تعليمية", "Course")}</span>
            <span>{course.level}</span>
            <span>{course.language}</span>
          </div>
          <h1>{course.title || t("دورة بلا عنوان", "Untitled course")}</h1>
          <p>{course.subtitle || course.description}</p>
          <div className={styles.previewTutorLine}>
            <div className={styles.previewAvatar}>
              {tutor?.user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tutor.user.avatarUrl} alt="" />
              ) : (
                <span>
                  {tutor?.user?.firstName?.[0] ?? "M"}
                  {tutor?.user?.lastName?.[0] ?? "R"}
                </span>
              )}
            </div>
            <span>
              {t("إعداد", "Created by")}{" "}
              <strong>
                {tutor?.user
                  ? `${tutor.user.firstName} ${tutor.user.lastName}`
                  : "MRH Academy"}
              </strong>
            </span>
          </div>
        </div>
        <div className={styles.previewCover}>
          {course.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={course.thumbnailUrl} alt={course.title} />
          ) : (
            <span>MRH Academy</span>
          )}
        </div>
      </section>

      <div className={styles.previewLayout}>
        <main>
          <section className={styles.previewSurface}>
            <h2>{t("ما الذي ستتعلمه", "What you will learn")}</h2>
            <ul className={styles.previewOutcomeGrid}>
              {(course.learningOutcomes ?? []).map((outcome) => (
                <li key={outcome}>
                  <PreviewIcon name="check" />
                  <span>{outcome}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.previewSurface}>
            <h2>{t("معاينة الدورة", "Course preview")}</h2>
            <SecureVideoPlayer
              playbackEndpoint={`/courses/${params.id}/media/preview/status`}
              title={t(
                `الفيديو التعريفي لدورة ${course.title}`,
                `${course.title} promo video`,
              )}
              missingMessage={t(
                "لم يُرفع الفيديو التعريفي بعد.",
                "Promo video has not been uploaded yet.",
              )}
              testId="preview-promo-video"
            />
          </section>

          <section className={styles.previewSurface}>
            <div className={styles.previewSectionHeading}>
              <div>
                <h2>{t("محتوى الدورة", "Course content")}</h2>
                <p>
                  {sections.length} {t("أقسام", "sections")} · {lessons.length}{" "}
                  {t("دروس", "lessons")} · {duration} {t("دقيقة", "minutes")}
                </p>
              </div>
            </div>
            <div className={styles.previewCurriculum}>
              {sections.map((section) => {
                const sectionLessons = lessons
                  .filter((lesson) => lesson.sectionId === section.id)
                  .sort((a, b) => a.lessonOrder - b.lessonOrder);
                return (
                  <details key={section.id} open>
                    <summary>
                      <strong>{section.title}</strong>
                      <span>
                        {sectionLessons.length} {t("درس", "lessons")}
                      </span>
                    </summary>
                    {sectionLessons.map((lesson) => (
                      <div className={styles.previewLesson} key={lesson.id}>
                        <PreviewIcon
                          name={
                            lesson.contentType === "video"
                              ? "play"
                              : lesson.contentType === "resource"
                                ? "file"
                                : "link"
                          }
                        />
                        <span>
                          <strong>{lesson.title}</strong>
                          {lesson.description && (
                            <small>{lesson.description}</small>
                          )}
                          {(lesson.downloadableFiles?.length ||
                            lesson.externalLinks?.length) && (
                            <small>
                              {(lesson.downloadableFiles ?? [])
                                .map((file) => file.name)
                                .join(" · ")}
                              {lesson.downloadableFiles?.length &&
                              lesson.externalLinks?.length
                                ? " · "
                                : ""}
                              {(lesson.externalLinks ?? [])
                                .map((link) => {
                                  try {
                                    return new URL(link.url).hostname;
                                  } catch {
                                    return link.title;
                                  }
                                })
                                .join(" · ")}
                            </small>
                          )}
                        </span>
                        <small>
                          {lesson.durationMinutes} {t("د", "min")}
                        </small>
                      </div>
                    ))}
                  </details>
                );
              })}
            </div>
          </section>

          <section className={styles.previewSurface}>
            <h2>{t("عن المدرّس", "Your instructor")}</h2>
            <div className={styles.previewTutor}>
              <div className={styles.previewAvatar}>
                {tutor?.user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tutor.user.avatarUrl} alt="" />
                ) : (
                  <span>
                    {tutor?.user?.firstName?.[0] ?? "M"}
                    {tutor?.user?.lastName?.[0] ?? "R"}
                  </span>
                )}
              </div>
              <div>
                <h3>
                  {tutor?.user
                    ? `${tutor.user.firstName} ${tutor.user.lastName}`
                    : "MRH Academy"}
                </h3>
                <strong>{tutor?.specialization}</strong>
                <p>
                  {tutor?.bio ||
                    t(
                      "مدرّس موثّق في أكاديمية MRH.",
                      "Verified MRH Academy instructor.",
                    )}
                </p>
              </div>
            </div>
          </section>

          <div className={styles.previewTwoColumns}>
            <section className={styles.previewSurface}>
              <h2>{t("المتطلبات", "Requirements")}</h2>
              <ul>
                {(course.requirements ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <section className={styles.previewSurface}>
              <h2>{t("لمن هذه الدورة؟", "Who this course is for")}</h2>
              <ul>
                {(course.targetAudience ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </div>
        </main>

        <aside className={styles.previewPurchase}>
          <strong>${Number(course.price).toFixed(2)}</strong>
          <button type="button" className="btn-primary" disabled>
            {t("شراء الدورة", "Buy course")}
          </button>
          <small>
            {t("غير متاح في وضع المعاينة", "Disabled in preview mode")}
          </small>
          <h2>{t("تشمل الدورة", "This course includes")}</h2>
          <ul>
            <li>
              <PreviewIcon name="clock" />
              {duration} {t("دقيقة من المحتوى", "minutes of content")}
            </li>
            <li>
              <PreviewIcon name="play" />
              {lessons.length} {t("دروس", "lessons")}
            </li>
            <li>
              <PreviewIcon name="file" />
              {resourceCount} {t("ملفات وروابط", "files and links")}
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
