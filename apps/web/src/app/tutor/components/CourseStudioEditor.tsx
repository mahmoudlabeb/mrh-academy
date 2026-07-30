"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";
import { VideoUploader } from "@/components/shared/VideoUploader";
import {
  getStudioCompletion,
  type CourseDraftField,
  type CourseDraftForm,
  validateCourseDraft,
} from "./course-studio-validation";
import styles from "./CourseStudio.module.css";

type ProductStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "rejected"
  | "archived";
type StudioStep =
  "basics" | "audience" | "curriculum" | "media" | "pricing" | "review";

type Course = {
  id: string;
  tutorId: string;
  title: string;
  subtitle: string | null;
  description: string;
  category: string | null;
  language: string;
  level: string;
  price: number;
  courseType: "recorded" | "live";
  thumbnailUrl: string | null;
  overviewVideoId: string | null;
  previewVideoUrl: string | null;
  learningOutcomes: string[] | null;
  requirements: string[] | null;
  targetAudience: string[] | null;
  capacity: number | null;
  cohortStartAt: string | null;
  cohortEndAt: string | null;
  status: ProductStatus;
  updatedAt?: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewDecision?: "approved" | "rejected" | null;
  reviewNote?: string | null;
  referralCode?: string | null;
};

type CourseSection = {
  id: string;
  title: string;
  description: string | null;
  sectionOrder: number;
};

type LessonFile = {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
};

type CourseLesson = {
  id: string;
  sectionId: string | null;
  title: string;
  description: string | null;
  contentType: "video" | "article" | "resource";
  videoAssetId: string | null;
  videoUrl: string | null;
  articleContent: string | null;
  resourceUrl: string | null;
  downloadableFiles: LessonFile[];
  externalLinks: Array<{ title: string; url: string }>;
  durationMinutes: number;
  lessonOrder: number;
  isPreview: boolean;
};

type Readiness = {
  ready: boolean;
  completed: number;
  total: number;
  progress: number;
  items: Array<{ key: string; label: string; complete: boolean }>;
};

type StudioResponse = {
  course: Course;
  sections: CourseSection[];
  lessons: CourseLesson[];
  readiness: Readiness;
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const CATEGORIES = [
  ["languages", "اللغات", "Languages"],
  ["business", "الأعمال", "Business"],
  ["technology", "التقنية", "Technology"],
  ["design", "التصميم", "Design"],
  ["personal-development", "التطوير الشخصي", "Personal development"],
  ["academics", "المواد الأكاديمية", "Academics"],
] as const;

function fromCourse(course: Course): CourseDraftForm {
  return {
    title: course.title ?? "",
    subtitle: course.subtitle ?? "",
    description: course.description ?? "",
    category: course.category ?? "",
    language: course.language ?? "Arabic",
    level: course.level ?? "beginner",
    price: String(course.price ?? 0),
    courseType: course.courseType ?? "recorded",
    learningOutcomes: course.learningOutcomes ?? [],
    requirements: course.requirements ?? [],
    targetAudience: course.targetAudience ?? [],
    capacity: String(course.capacity ?? 12),
    cohortStartAt: course.cohortStartAt?.slice(0, 16) ?? "",
    cohortEndAt: course.cohortEndAt?.slice(0, 16) ?? "",
  };
}

function apiError(error: unknown, fallback: string) {
  const message = (
    error as { response?: { data?: { message?: string | string[] } } }
  )?.response?.data?.message;
  if (Array.isArray(message)) return message.join(" ");
  return typeof message === "string" ? message : fallback;
}

function lessonIsComplete(lesson: CourseLesson) {
  if (lesson.contentType === "video")
    return Boolean(lesson.videoUrl || lesson.videoAssetId);
  if (lesson.contentType === "article")
    return Boolean(lesson.articleContent?.trim());
  return Boolean(
    lesson.resourceUrl ||
    lesson.downloadableFiles?.length ||
    lesson.externalLinks?.length,
  );
}

function StudioIcon({
  name,
}: {
  name:
    | "arrow"
    | "check"
    | "lock"
    | "save"
    | "preview"
    | "send"
    | "plus"
    | "edit"
    | "trash"
    | "up"
    | "down"
    | "file"
    | "link"
    | "video";
}) {
  const paths: Record<typeof name, ReactNode> = {
    arrow: <path d="m15 18-6-6 6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    save: (
      <>
        <path d="M5 4h12l2 2v14H5V4Z" />
        <path d="M8 4v6h8V4M8 20v-6h8v6" />
      </>
    ),
    preview: (
      <>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    send: (
      <>
        <path d="m21 3-7.5 18-3.2-7.3L3 10.5 21 3Z" />
        <path d="m10.5 13.5 4-4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    edit: (
      <>
        <path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" />
      </>
    ),
    trash: (
      <>
        <path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13" />
        <path d="M10 11v5M14 11v5" />
      </>
    ),
    up: <path d="m6 15 6-6 6 6" />,
    down: <path d="m6 9 6 6 6-6" />,
    file: (
      <>
        <path d="M6 3h8l4 4v14H6V3Z" />
        <path d="M14 3v5h4" />
      </>
    ),
    link: (
      <>
        <path d="m10 13 4-4" />
        <path d="M8.5 16.5 6 19a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0" />
        <path d="m15.5 7.5 2.5-2.5a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0" />
      </>
    ),
    video: (
      <>
        <rect x="3" y="6" width="13" height="12" rx="2" />
        <path d="m16 10 5-3v10l-5-3" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function CourseStudioEditor({ courseId }: { courseId?: string }) {
  if (!courseId) return <NewCourseStart />;
  return <ExistingCourseStudio courseId={courseId} />;
}

function NewCourseStart() {
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [courseType, setCourseType] = useState<"recorded" | "live">("recorded");
  const createDraft = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<Course>("/courses/drafts", {
          courseType,
        })
      ).data,
    onSuccess: async (course) => {
      await queryClient.invalidateQueries({ queryKey: ["my-courses"] });
      router.replace(`/${lang}/teach/courses/${course.id}/studio?created=1`);
    },
  });

  return (
    <section className={styles.start}>
      <Link href={`/${lang}/teach/courses`} className={styles.backLink}>
        <StudioIcon name="arrow" />
        {t("العودة إلى الدورات", "Back to courses")}
      </Link>
      <div className={styles.startPanel}>
        <span className={styles.eyebrow}>{t("دورة جديدة", "New course")}</span>
        <h1>
          {t(
            "ما نوع الدورة التي ستنشئها؟",
            "What kind of course are you creating?",
          )}
        </h1>
        <p>
          {t(
            "سننشئ مسودة آمنة أولًا، ثم يمكنك حفظ تقدمك وإكمال المحتوى على مراحل.",
            "We will create a secure draft first, then you can save progress and build the content in stages.",
          )}
        </p>
        <div className={styles.courseTypeGrid}>
          <button
            type="button"
            className={
              courseType === "recorded" ? styles.selectedType : undefined
            }
            onClick={() => setCourseType("recorded")}
          >
            <StudioIcon name="video" />
            <strong>{t("دورة مسجلة", "Recorded course")}</strong>
            <span>
              {t(
                "فيديوهات ودروس وملفات يتعلم منها الطالب في أي وقت.",
                "Videos, lessons, and files students can learn from anytime.",
              )}
            </span>
          </button>
          <button
            type="button"
            className={courseType === "live" ? styles.selectedType : undefined}
            onClick={() => setCourseType("live")}
          >
            <StudioIcon name="preview" />
            <strong>{t("دفعة مباشرة", "Live cohort")}</strong>
            <span>
              {t(
                "برنامج بزمن محدد وسعة طلابية وجدول بداية ونهاية.",
                "A scheduled program with dates and a learner capacity.",
              )}
            </span>
          </button>
        </div>
        {createDraft.isError && (
          <p className={styles.formError} role="alert">
            {apiError(
              createDraft.error,
              t(
                "تعذّر إنشاء المسودة. حاول مرة أخرى.",
                "Draft could not be created. Try again.",
              ),
            )}
          </p>
        )}
        <button
          type="button"
          className="btn-primary"
          disabled={createDraft.isPending}
          onClick={() => createDraft.mutate()}
          data-testid="create-course-draft"
        >
          <StudioIcon name="plus" />
          {createDraft.isPending
            ? t("جاري إنشاء المسودة…", "Creating draft…")
            : t("إنشاء المسودة والبدء", "Create draft and continue")}
        </button>
      </div>
    </section>
  );
}

function ExistingCourseStudio({ courseId }: { courseId: string }) {
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<StudioStep>("basics");
  const [draft, setDraft] = useState<CourseDraftForm | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [visited, setVisited] = useState<Set<CourseDraftField>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const initializedRef = useRef<string | null>(null);
  const studioQuery = useQuery({
    queryKey: ["course-studio", courseId],
    queryFn: async () =>
      (await apiClient.get<StudioResponse>(`/courses/${courseId}/studio`)).data,
    retry: false,
  });
  const promoStatusQuery = useQuery({
    queryKey: ["course-promo-status", courseId],
    queryFn: async () =>
      (
        await apiClient.get<{ status: string }>(
          `/courses/${courseId}/media/preview/status`,
        )
      ).data,
    retry: false,
  });

  useEffect(() => {
    if (!studioQuery.data || initializedRef.current === courseId) return;
    initializedRef.current = courseId;
    setDraft(fromCourse(studioQuery.data.course));
    setCoverUrl(studioQuery.data.course.thumbnailUrl);
    setLastSavedAt(
      studioQuery.data.course.updatedAt
        ? new Date(studioQuery.data.course.updatedAt)
        : null,
    );
    setSaveState("saved");
  }, [courseId, studioQuery.data]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  const refreshStudio = async () => {
    await Promise.all([
      studioQuery.refetch(),
      promoStatusQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ["my-courses"] }),
    ]);
  };

  const saveDraft = useMutation({
    mutationFn: async (values: CourseDraftForm) => {
      setSaveState("saving");
      return (
        await apiClient.patch<Course>(`/courses/${courseId}`, {
          title: values.title.trim(),
          subtitle: values.subtitle.trim(),
          description: values.description.trim(),
          category: values.category,
          language: values.language,
          level: values.level,
          price: Number(values.price || 0),
          courseType: values.courseType,
          learningOutcomes: values.learningOutcomes.filter(Boolean),
          requirements: values.requirements.filter(Boolean),
          targetAudience: values.targetAudience.filter(Boolean),
          capacity:
            values.courseType === "live"
              ? Number(values.capacity || 0)
              : undefined,
          cohortStartAt:
            values.courseType === "live" && values.cohortStartAt
              ? values.cohortStartAt
              : undefined,
          cohortEndAt:
            values.courseType === "live" && values.cohortEndAt
              ? values.cohortEndAt
              : undefined,
        })
      ).data;
    },
    onSuccess: async () => {
      setSaveState("saved");
      setLastSavedAt(new Date());
      await refreshStudio();
    },
    onError: () => setSaveState("error"),
  });

  const submitCourse = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error("Draft is not loaded.");
      if (saveState === "dirty" || saveState === "error") {
        await saveDraft.mutateAsync(draft);
      }
      return (await apiClient.post<Course>(`/courses/${courseId}/submit`)).data;
    },
    onSuccess: async () => {
      await refreshStudio();
      router.replace(`/${lang}/teach/courses/${courseId}/studio?submitted=1`);
    },
  });

  const reviseCourse = useMutation({
    mutationFn: async () =>
      (await apiClient.post<Course>(`/courses/${courseId}/revise`)).data,
    onSuccess: async () => {
      initializedRef.current = null;
      await refreshStudio();
    },
  });

  const readonly = studioQuery.data
    ? studioQuery.data.course.status !== "draft"
    : false;
  const lessons = studioQuery.data?.lessons ?? [];
  const completeLessonCount = lessons.filter(lessonIsComplete).length;
  const hasPromoVideo =
    promoStatusQuery.data?.status !== undefined &&
    promoStatusQuery.data.status !== "missing";
  const completion = draft
    ? getStudioCompletion(draft, {
        hasCover: Boolean(coverUrl),
        hasPromoVideo,
        sectionCount: studioQuery.data?.sections.length ?? 0,
        completeLessonCount,
      })
    : {
        basics: false,
        audience: false,
        curriculum: false,
        media: false,
        pricing: false,
      };
  const ready = Object.values(completion).every(Boolean);
  const completedCount = Object.values(completion).filter(Boolean).length;
  const progress = Math.round((completedCount / 5) * 100);
  const errors = draft ? validateCourseDraft(draft) : {};

  const steps: Array<{
    id: StudioStep;
    label: string;
    description: string;
    complete: boolean;
    locked?: boolean;
  }> = [
    {
      id: "basics",
      label: t("أساسيات الدورة", "Course basics"),
      description: t("العنوان والتصنيف", "Title and classification"),
      complete: completion.basics,
    },
    {
      id: "audience",
      label: t("الجمهور والأهداف", "Audience and outcomes"),
      description: t("ما الذي سيحققه الطالب", "What students will achieve"),
      complete: completion.audience,
    },
    {
      id: "curriculum",
      label: t("المنهج", "Curriculum"),
      description: t(
        "الأقسام والدروس والملفات",
        "Sections, lessons, and files",
      ),
      complete: completion.curriculum,
    },
    {
      id: "media",
      label: t("وسائط الدورة", "Course media"),
      description: t("الغلاف والفيديو التعريفي", "Cover and promo video"),
      complete: completion.media,
    },
    {
      id: "pricing",
      label: t("التسعير", "Pricing"),
      description: t("سعر الطالب", "Student price"),
      complete: completion.pricing,
    },
    {
      id: "review",
      label: t("المراجعة والإرسال", "Review and submit"),
      description: ready
        ? t("جاهزة للإرسال", "Ready to submit")
        : t("أكمل الأقسام السابقة", "Complete previous sections"),
      complete: readonly,
      locked: !ready && !readonly,
    },
  ];

  function update<K extends keyof CourseDraftForm>(
    key: K,
    value: CourseDraftForm[K],
  ) {
    if (!draft || readonly) return;
    setDraft({ ...draft, [key]: value });
    setSaveState("dirty");
  }

  function markVisited(field: CourseDraftField) {
    setVisited((current) => new Set(current).add(field));
  }

  function fieldError(field: CourseDraftField) {
    if (!visited.has(field) && !submitAttempted) return undefined;
    const code = errors[field];
    if (!code) return undefined;
    const messages: Record<string, string> = {
      title_min: t(
        "اكتب عنوانًا واضحًا من 10 أحرف على الأقل.",
        "Use at least 10 characters for the title.",
      ),
      subtitle_min: t(
        "اكتب عنوانًا فرعيًا من 20 حرفًا على الأقل.",
        "Use at least 20 characters for the subtitle.",
      ),
      description_min: t(
        "اكتب وصفًا تفصيليًا من 100 حرف على الأقل.",
        "Write a detailed description of at least 100 characters.",
      ),
      category_required: t("اختر تصنيف الدورة.", "Choose a course category."),
      language_required: t("اختر لغة الدورة.", "Choose the course language."),
      level_required: t("اختر مستوى الدورة.", "Choose the course level."),
      price_invalid: t(
        "أدخل سعرًا صحيحًا لا يقل عن صفر.",
        "Enter a valid price of zero or more.",
      ),
      outcomes_required: t(
        "أضف نتيجة تعلم واحدة على الأقل.",
        "Add at least one learning outcome.",
      ),
      requirements_required: t(
        "أضف متطلبًا واحدًا على الأقل.",
        "Add at least one requirement.",
      ),
      audience_required: t(
        "حدّد الفئة المستهدفة.",
        "Add at least one target audience item.",
      ),
      capacity_invalid: t(
        "يجب ألا تقل السعة عن طالبين.",
        "Capacity must be at least two.",
      ),
      start_required: t(
        "حدّد تاريخ بداية الدفعة.",
        "Choose the cohort start date.",
      ),
      end_required: t(
        "حدّد تاريخ نهاية الدفعة.",
        "Choose the cohort end date.",
      ),
      end_after_start: t(
        "يجب أن يكون تاريخ النهاية بعد البداية.",
        "The end date must be after the start date.",
      ),
    };
    return messages[code] ?? code;
  }

  async function openPreview() {
    if (!draft) return;
    if (!readonly && saveState === "dirty") {
      try {
        await saveDraft.mutateAsync(draft);
      } catch {
        return;
      }
    }
    router.push(`/${lang}/teach/courses/${courseId}/preview`);
  }

  function handleSubmit() {
    setSubmitAttempted(true);
    if (!ready) {
      const firstIncomplete = steps.find(
        (item) => item.id !== "review" && !item.complete,
      );
      if (firstIncomplete) setStep(firstIncomplete.id);
      return;
    }
    submitCourse.mutate();
  }

  if (studioQuery.isLoading || !draft) {
    return (
      <div
        className={`${styles.studioLoading} skeleton`}
        aria-label={t("جاري تحميل الاستوديو", "Loading studio")}
      />
    );
  }
  if (studioQuery.isError || !studioQuery.data) {
    return (
      <section className={styles.studioError} role="alert">
        <strong>
          {t("تعذّر فتح استوديو الدورة", "Course studio could not be opened")}
        </strong>
        <p>
          {apiError(
            studioQuery.error,
            t(
              "تحقق من الاتصال ثم حاول مرة أخرى.",
              "Check your connection and try again.",
            ),
          )}
        </p>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => studioQuery.refetch()}
        >
          {t("إعادة المحاولة", "Try again")}
        </button>
        <Link href={`/${lang}/teach/courses`} className="btn-ghost">
          {t("العودة إلى الدورات", "Back to courses")}
        </Link>
      </section>
    );
  }

  const course = studioQuery.data.course;
  const saveLabel =
    saveState === "saving"
      ? t("جاري الحفظ…", "Saving…")
      : saveState === "dirty"
        ? t("توجد تغييرات غير محفوظة", "Unsaved changes")
        : saveState === "error"
          ? t("تعذّر الحفظ", "Save failed")
          : lastSavedAt
            ? t(
                `تم الحفظ ${lastSavedAt.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`,
                `Saved ${lastSavedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
              )
            : t("مسودة محفوظة", "Draft saved");

  return (
    <div className={styles.studio} data-testid="course-studio">
      <header className={styles.studioBar}>
        <div className={styles.studioIdentity}>
          <Link
            href={`/${lang}/teach/courses`}
            aria-label={t("العودة إلى الدورات", "Back to courses")}
          >
            <StudioIcon name="arrow" />
          </Link>
          <div>
            <strong>
              {draft.title || t("دورة بلا عنوان", "Untitled course")}
            </strong>
            <span>
              {readonly
                ? course.status === "active"
                  ? t("منشورة", "Published")
                  : course.status === "rejected"
                    ? t("تحتاج تعديلات", "Changes needed")
                    : t("قيد المراجعة", "In review")
                : t("مسودة", "Draft")}
            </span>
          </div>
        </div>
        <div
          className={styles.saveStatus}
          data-state={saveState}
          aria-live="polite"
        >
          <span />
          {saveLabel}
        </div>
        <div className={styles.studioActions}>
          {course.status === "rejected" && (
            <button
              type="button"
              className="btn-primary"
              disabled={reviseCourse.isPending}
              onClick={() => reviseCourse.mutate()}
              data-testid="revise-course"
            >
              <StudioIcon name="edit" />
              {reviseCourse.isPending
                ? t("جاري فتح المسودة…", "Opening draft…")
                : t("تعديل وإعادة الإرسال", "Revise and resubmit")}
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={openPreview}>
            <StudioIcon name="preview" />
            {t("معاينة", "Preview")}
          </button>
          {!readonly && (
            <button
              type="button"
              className="btn-secondary"
              disabled={saveDraft.isPending || saveState === "saved"}
              onClick={() => saveDraft.mutate(draft)}
              data-testid="save-course-draft"
            >
              <StudioIcon name="save" />
              {t("حفظ", "Save")}
            </button>
          )}
          {!readonly && (
            <button
              type="button"
              className="btn-primary"
              disabled={!ready || submitCourse.isPending || saveDraft.isPending}
              onClick={handleSubmit}
              title={
                ready
                  ? undefined
                  : t(
                      "أكمل جميع الأقسام المطلوبة أولًا.",
                      "Complete every required section first.",
                    )
              }
              data-testid="submit-course"
            >
              <StudioIcon name="send" />
              {submitCourse.isPending
                ? t("جاري الإرسال…", "Submitting…")
                : t("إرسال للمراجعة", "Submit for review")}
            </button>
          )}
        </div>
      </header>

      <div className={styles.studioLayout}>
        <aside
          className={styles.studioNav}
          aria-label={t("أقسام إعداد الدورة", "Course setup sections")}
        >
          <div className={styles.progressBlock}>
            <div>
              <strong>{progress}%</strong>
              <span>{t("اكتمال الدورة", "Course completion")}</span>
            </div>
            <div
              className={styles.progressTrack}
              aria-label={t("نسبة اكتمال الدورة", "Course completion")}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
          <nav>
            {steps.map((item, index) => (
              <button
                type="button"
                key={item.id}
                className={step === item.id ? styles.activeStep : undefined}
                data-complete={item.complete}
                data-locked={item.locked}
                disabled={item.locked}
                aria-label={item.label}
                onClick={() => setStep(item.id)}
              >
                <span className={styles.stepState}>
                  {item.locked ? (
                    <StudioIcon name="lock" />
                  ) : item.complete ? (
                    <StudioIcon name="check" />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            ))}
          </nav>
          {!ready && !readonly && (
            <p className={styles.navHint}>
              {t(
                "يُفتح الإرسال النهائي بعد اكتمال الأقسام الخمسة.",
                "Final submission unlocks after all five sections are complete.",
              )}
            </p>
          )}
        </aside>

        <main className={styles.editor}>
          {course.status === "rejected" && (
            <div className={styles.rejectionNotice} role="alert">
              <StudioIcon name="edit" />
              <div>
                <strong>
                  {t(
                    "راجع ملاحظات فريق الأكاديمية",
                    "Review the academy team’s feedback",
                  )}
                </strong>
                <p>
                  {course.reviewNote ||
                    t(
                      "يحتاج هذا المنتج إلى تعديلات قبل إعادة إرساله للمراجعة.",
                      "This product needs changes before it can be submitted again.",
                    )}
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={reviseCourse.isPending}
                  onClick={() => reviseCourse.mutate()}
                >
                  {t("فتح المنتج للتعديل", "Open for revision")}
                </button>
              </div>
            </div>
          )}
          {readonly && (
            <div className={styles.readonlyNotice}>
              <StudioIcon name="lock" />
              <div>
                <strong>
                  {t("الدورة في وضع القراءة فقط", "Course is read-only")}
                </strong>
                <p>
                  {course.status === "active"
                    ? t(
                        "هذه الدورة منشورة حاليًا.",
                        "This course is currently published.",
                      )
                    : t(
                        "أُرسلت الدورة للمراجعة ولا يمكن تعديلها الآن.",
                        "This course is under review and cannot be edited now.",
                      )}
                </p>
              </div>
            </div>
          )}
          {reviseCourse.isError && (
            <div className={styles.errorNotice} role="alert">
              <strong>
                {t("تعذّر فتح المنتج للتعديل", "Could not open the product for revision")}
              </strong>
              <p>
                {apiError(
                  reviseCourse.error,
                  t("حاول مرة أخرى.", "Please try again."),
                )}
              </p>
            </div>
          )}
          {saveDraft.isError && (
            <div className={styles.errorNotice} role="alert">
              <strong>
                {t("لم تُحفظ التغييرات", "Changes were not saved")}
              </strong>
              <p>
                {apiError(
                  saveDraft.error,
                  t("حاول الحفظ مرة أخرى.", "Try saving again."),
                )}
              </p>
            </div>
          )}
          {submitCourse.isError && (
            <div className={styles.errorNotice} role="alert">
              <strong>
                {t("الدورة غير جاهزة للإرسال", "Course is not ready to submit")}
              </strong>
              <p>
                {apiError(
                  submitCourse.error,
                  t(
                    "راجع الأقسام غير المكتملة.",
                    "Review the incomplete sections.",
                  ),
                )}
              </p>
            </div>
          )}
          {step === "basics" && (
            <BasicsStep
              draft={draft}
              update={update}
              readonly={readonly}
              t={t}
              fieldError={fieldError}
              markVisited={markVisited}
            />
          )}
          {step === "audience" && (
            <AudienceStep
              draft={draft}
              update={update}
              readonly={readonly}
              t={t}
              fieldError={fieldError}
              markVisited={markVisited}
            />
          )}
          {step === "curriculum" && (
            <CurriculumBuilder
              courseId={courseId}
              sections={studioQuery.data.sections}
              lessons={lessons}
              readonly={readonly}
              refresh={refreshStudio}
              t={t}
            />
          )}
          {step === "media" && (
            <MediaStep
              courseId={courseId}
              coverUrl={coverUrl}
              setCoverUrl={setCoverUrl}
              readonly={readonly}
              refresh={refreshStudio}
              t={t}
            />
          )}
          {step === "pricing" && (
            <PricingStep
              draft={draft}
              update={update}
              readonly={readonly}
              t={t}
              error={fieldError("price")}
              markVisited={() => markVisited("price")}
            />
          )}
          {step === "review" && (
            <ReviewStep
              course={course}
              draft={draft}
              readiness={studioQuery.data.readiness}
              sections={studioQuery.data.sections}
              lessons={lessons}
              ready={ready}
              readonly={readonly}
              submitting={submitCourse.isPending}
              onPreview={openPreview}
              onSubmit={handleSubmit}
              t={t}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function StepHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className={styles.stepHeading}>
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      {children}
      {error && <em role="alert">{error}</em>}
    </label>
  );
}

type StepFormProps = {
  draft: CourseDraftForm;
  update: <K extends keyof CourseDraftForm>(
    key: K,
    value: CourseDraftForm[K],
  ) => void;
  readonly: boolean;
  t: (ar: string, en: string) => string;
  fieldError: (field: CourseDraftField) => string | undefined;
  markVisited: (field: CourseDraftField) => void;
};

function BasicsStep({
  draft,
  update,
  readonly,
  t,
  fieldError,
  markVisited,
}: StepFormProps) {
  return (
    <>
      <StepHeading
        eyebrow={t("الخطوة 1", "Step 1")}
        title={t("أساسيات الدورة", "Course basics")}
        description={t(
          "اكتب وعدًا واضحًا للطالب وساعده على فهم موضوع الدورة ومستواها بسرعة.",
          "Set a clear learner promise and make the topic and level easy to understand.",
        )}
      />
      <section className={styles.formSection}>
        <div className={styles.sectionTitle}>
          <div>
            <h2>{t("هوية الدورة", "Course identity")}</h2>
            <p>
              {t(
                "تظهر هذه البيانات في صفحة الدورة ونتائج البحث.",
                "These details appear on the course page and in search.",
              )}
            </p>
          </div>
          <span>{t("مطلوب", "Required")}</span>
        </div>
        <Field
          label={t("عنوان الدورة", "Course title")}
          hint={`${draft.title.length}/200`}
          error={fieldError("title")}
        >
          <input
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
            onBlur={() => markVisited("title")}
            disabled={readonly}
            maxLength={200}
            placeholder={t(
              "مثال: المحادثة العربية للمبتدئين",
              "e.g. Arabic conversation for beginners",
            )}
            data-testid="course-title"
          />
        </Field>
        <Field
          label={t("العنوان الفرعي", "Course subtitle")}
          hint={`${draft.subtitle.length}/240`}
          error={fieldError("subtitle")}
        >
          <input
            value={draft.subtitle}
            onChange={(event) => update("subtitle", event.target.value)}
            onBlur={() => markVisited("subtitle")}
            disabled={readonly}
            maxLength={240}
            placeholder={t(
              "اشرح النتيجة الرئيسية التي سيحققها الطالب",
              "Describe the main result students will achieve",
            )}
            data-testid="course-subtitle"
          />
        </Field>
        <Field
          label={t("وصف الدورة", "Course description")}
          hint={`${draft.description.length}/5000`}
          error={fieldError("description")}
        >
          <textarea
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
            onBlur={() => markVisited("description")}
            disabled={readonly}
            maxLength={5000}
            rows={8}
            placeholder={t(
              "اشرح محتوى الدورة، أسلوبها، وما الذي يجعلها مناسبة للطالب…",
              "Explain the content, teaching approach, and why this course is right for the learner…",
            )}
            data-testid="course-description"
          />
        </Field>
      </section>

      <section className={styles.formSection}>
        <div className={styles.sectionTitle}>
          <div>
            <h2>{t("التصنيف والإعداد", "Classification and setup")}</h2>
            <p>
              {t(
                "تساعد هذه الخيارات الطلاب على اكتشاف الدورة المناسبة.",
                "These choices help students find the right course.",
              )}
            </p>
          </div>
        </div>
        <div className={styles.fieldGrid}>
          <Field
            label={t("التصنيف", "Category")}
            error={fieldError("category")}
          >
            <select
              value={draft.category}
              onChange={(event) => update("category", event.target.value)}
              onBlur={() => markVisited("category")}
              disabled={readonly}
              data-testid="course-category"
            >
              <option value="">{t("اختر التصنيف", "Choose a category")}</option>
              {CATEGORIES.map(([value, ar, en]) => (
                <option value={value} key={value}>
                  {t(ar, en)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("المستوى", "Level")} error={fieldError("level")}>
            <select
              value={draft.level}
              onChange={(event) => update("level", event.target.value)}
              onBlur={() => markVisited("level")}
              disabled={readonly}
              data-testid="course-level"
            >
              <option value="beginner">{t("مبتدئ", "Beginner")}</option>
              <option value="intermediate">{t("متوسط", "Intermediate")}</option>
              <option value="advanced">{t("متقدم", "Advanced")}</option>
              <option value="all-levels">
                {t("جميع المستويات", "All levels")}
              </option>
            </select>
          </Field>
          <Field
            label={t("لغة الدورة", "Course language")}
            error={fieldError("language")}
          >
            <select
              value={draft.language}
              onChange={(event) => update("language", event.target.value)}
              onBlur={() => markVisited("language")}
              disabled={readonly}
              data-testid="course-language"
            >
              <option value="Arabic">{t("العربية", "Arabic")}</option>
              <option value="English">{t("الإنجليزية", "English")}</option>
              <option value="French">{t("الفرنسية", "French")}</option>
              <option value="German">{t("الألمانية", "German")}</option>
            </select>
          </Field>
          <Field label={t("نوع الدورة", "Course format")}>
            <select
              value={draft.courseType}
              onChange={(event) =>
                update(
                  "courseType",
                  event.target.value as CourseDraftForm["courseType"],
                )
              }
              disabled={readonly}
            >
              <option value="recorded">{t("مسجلة", "Recorded")}</option>
              <option value="live">{t("دفعة مباشرة", "Live cohort")}</option>
            </select>
          </Field>
        </div>
        {draft.courseType === "live" && (
          <div className={styles.liveFields}>
            <Field
              label={t("السعة", "Capacity")}
              error={fieldError("capacity")}
            >
              <input
                type="number"
                min={2}
                max={500}
                value={draft.capacity}
                onChange={(event) => update("capacity", event.target.value)}
                onBlur={() => markVisited("capacity")}
                disabled={readonly}
              />
            </Field>
            <Field
              label={t("تاريخ البداية", "Start date")}
              error={fieldError("cohortStartAt")}
            >
              <input
                type="datetime-local"
                value={draft.cohortStartAt}
                onChange={(event) =>
                  update("cohortStartAt", event.target.value)
                }
                onBlur={() => markVisited("cohortStartAt")}
                disabled={readonly}
              />
            </Field>
            <Field
              label={t("تاريخ النهاية", "End date")}
              error={fieldError("cohortEndAt")}
            >
              <input
                type="datetime-local"
                value={draft.cohortEndAt}
                onChange={(event) => update("cohortEndAt", event.target.value)}
                onBlur={() => markVisited("cohortEndAt")}
                disabled={readonly}
              />
            </Field>
          </div>
        )}
      </section>
    </>
  );
}

function AudienceStep({
  draft,
  update,
  readonly,
  t,
  fieldError,
  markVisited,
}: StepFormProps) {
  return (
    <>
      <StepHeading
        eyebrow={t("الخطوة 2", "Step 2")}
        title={t("الجمهور والأهداف", "Audience and outcomes")}
        description={t(
          "حدّد النتيجة التي يشتري الطالب الدورة من أجلها، وما يحتاجه قبل البدء.",
          "Define the result students are buying, and what they need before starting.",
        )}
      />
      <ListField
        title={t("ما الذي سيتعلمه الطالب؟", "What will students learn?")}
        description={t(
          "اكتب نتائج قابلة للقياس تبدأ بفعل واضح.",
          "Use measurable outcomes that begin with a clear action.",
        )}
        placeholder={t(
          "مثال: إجراء محادثة يومية بثقة",
          "e.g. Hold an everyday conversation confidently",
        )}
        values={draft.learningOutcomes}
        onChange={(values) => update("learningOutcomes", values)}
        onBlur={() => markVisited("learningOutcomes")}
        error={fieldError("learningOutcomes")}
        readonly={readonly}
        addLabel={t("إضافة نتيجة", "Add outcome")}
        t={t}
        testId="learning-outcomes"
      />
      <ListField
        title={t("متطلبات الدورة", "Course requirements")}
        description={t(
          "اذكر الخبرة أو الأدوات المطلوبة، أو وضّح أنه لا توجد متطلبات.",
          "List required experience or tools, or state that none are needed.",
        )}
        placeholder={t(
          "مثال: لا تحتاج إلى خبرة سابقة",
          "e.g. No previous experience required",
        )}
        values={draft.requirements}
        onChange={(values) => update("requirements", values)}
        onBlur={() => markVisited("requirements")}
        error={fieldError("requirements")}
        readonly={readonly}
        addLabel={t("إضافة متطلب", "Add requirement")}
        t={t}
        testId="course-requirements"
      />
      <ListField
        title={t("الفئة المستهدفة", "Target audience")}
        description={t(
          "صف الطالب الذي سيستفيد أكثر من هذه الدورة.",
          "Describe who will benefit most from this course.",
        )}
        placeholder={t(
          "مثال: المبتدئون الراغبون في ممارسة المحادثة",
          "e.g. Beginners who want conversation practice",
        )}
        values={draft.targetAudience}
        onChange={(values) => update("targetAudience", values)}
        onBlur={() => markVisited("targetAudience")}
        error={fieldError("targetAudience")}
        readonly={readonly}
        addLabel={t("إضافة فئة", "Add audience")}
        t={t}
        testId="target-audience"
      />
    </>
  );
}

function ListField({
  title,
  description,
  placeholder,
  values,
  onChange,
  onBlur,
  error,
  readonly,
  addLabel,
  t,
  testId,
}: {
  title: string;
  description: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
  onBlur: () => void;
  error?: string;
  readonly: boolean;
  addLabel: string;
  t: (ar: string, en: string) => string;
  testId: string;
}) {
  const [value, setValue] = useState("");
  function add() {
    if (!value.trim()) return;
    onChange([...values, value.trim()]);
    setValue("");
  }
  return (
    <section className={styles.formSection} data-testid={testId}>
      <div className={styles.sectionTitle}>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span>{t("مطلوب", "Required")}</span>
      </div>
      {values.length > 0 && (
        <ul className={styles.listItems}>
          {values.map((item, index) => (
            <li key={`${item}-${index}`}>
              <span>
                <StudioIcon name="check" />
              </span>
              <strong>{item}</strong>
              {!readonly && (
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      values.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  aria-label={t("حذف العنصر", "Remove item")}
                >
                  <StudioIcon name="trash" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readonly && (
        <div className={styles.inlineAdd}>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onBlur={onBlur}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              add();
            }}
            placeholder={placeholder}
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={!value.trim()}
            onClick={add}
          >
            <StudioIcon name="plus" />
            {addLabel}
          </button>
        </div>
      )}
      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function CurriculumBuilder({
  courseId,
  sections,
  lessons,
  readonly,
  refresh,
  t,
}: {
  courseId: string;
  sections: CourseSection[];
  lessons: CourseLesson[];
  readonly: boolean;
  refresh: () => Promise<void>;
  t: (ar: string, en: string) => string;
}) {
  const [sectionTitle, setSectionTitle] = useState("");
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionEditTitle, setSectionEditTitle] = useState("");
  const [lessonSection, setLessonSection] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<CourseLesson | null>(null);
  const [error, setError] = useState("");
  const addSection = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post(`/courses/${courseId}/sections`, {
          title: sectionTitle.trim(),
        })
      ).data,
    onSuccess: async () => {
      setSectionTitle("");
      setError("");
      await refresh();
    },
    onError: (requestError) =>
      setError(
        apiError(
          requestError,
          t("تعذّرت إضافة القسم.", "Section could not be added."),
        ),
      ),
  });
  const updateSection = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) =>
      (
        await apiClient.patch(`/courses/${courseId}/sections/${id}`, {
          title,
        })
      ).data,
    onSuccess: async () => {
      setEditingSection(null);
      await refresh();
    },
  });
  const deleteSection = useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.delete(`/courses/${courseId}/sections/${id}`)).data,
    onSuccess: refresh,
  });
  const reorderSections = useMutation({
    mutationFn: async (ids: string[]) =>
      (await apiClient.post(`/courses/${courseId}/sections/reorder`, { ids }))
        .data,
    onSuccess: refresh,
  });
  const deleteLesson = useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.delete(`/courses/${courseId}/lessons/${id}`)).data,
    onSuccess: refresh,
  });
  const reorderLessons = useMutation({
    mutationFn: async (ids: string[]) =>
      (await apiClient.post(`/courses/${courseId}/lessons/reorder`, { ids }))
        .data,
    onSuccess: refresh,
  });

  function moveSection(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const ids = sections.map((section) => section.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderSections.mutate(ids);
  }

  function moveLesson(
    lessonId: string,
    sectionLessons: CourseLesson[],
    delta: number,
  ) {
    const localIndex = sectionLessons.findIndex(
      (lesson) => lesson.id === lessonId,
    );
    const targetLesson = sectionLessons[localIndex + delta];
    if (!targetLesson) return;
    const ids = [...lessons]
      .sort((a, b) => a.lessonOrder - b.lessonOrder)
      .map((lesson) => lesson.id);
    const first = ids.indexOf(lessonId);
    const second = ids.indexOf(targetLesson.id);
    [ids[first], ids[second]] = [ids[second], ids[first]];
    reorderLessons.mutate(ids);
  }

  return (
    <>
      <StepHeading
        eyebrow={t("الخطوة 3", "Step 3")}
        title={t("بناء المنهج", "Build your curriculum")}
        description={t(
          "قسّم الدورة إلى أقسام واضحة، ثم أضف الدروس والروابط والملفات بالترتيب.",
          "Organize the course into clear sections, then add lessons, links, and files in order.",
        )}
      />
      {!readonly && (
        <section className={styles.curriculumToolbar}>
          <div>
            <strong>{t("أضف قسمًا جديدًا", "Add a new section")}</strong>
            <span>
              {t(
                "مثال: الوحدة الأولى — الأساسيات",
                "e.g. Section 1 — Foundations",
              )}
            </span>
          </div>
          <div className={styles.inlineAdd}>
            <input
              value={sectionTitle}
              onChange={(event) => setSectionTitle(event.target.value)}
              placeholder={t("عنوان القسم", "Section title")}
              data-testid="section-title"
            />
            <button
              type="button"
              className="btn-primary"
              disabled={!sectionTitle.trim() || addSection.isPending}
              onClick={() => addSection.mutate()}
              data-testid="add-section"
            >
              <StudioIcon name="plus" />
              {t("إضافة قسم", "Add section")}
            </button>
          </div>
          {error && (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          )}
        </section>
      )}
      {sections.length === 0 ? (
        <div className={styles.curriculumEmpty}>
          <span>
            <StudioIcon name="file" />
          </span>
          <strong>
            {t(
              "ابدأ بأول قسم في الدورة",
              "Start with your first course section",
            )}
          </strong>
          <p>
            {t(
              "كل قسم يجمع مجموعة مترابطة من الدروس.",
              "Each section groups a related set of lessons.",
            )}
          </p>
        </div>
      ) : (
        <div className={styles.sectionList}>
          {sections.map((section, sectionIndex) => {
            const sectionLessons = lessons
              .filter((lesson) => lesson.sectionId === section.id)
              .sort((a, b) => a.lessonOrder - b.lessonOrder);
            return (
              <section className={styles.curriculumSection} key={section.id}>
                <header>
                  <span className={styles.dragIndex}>
                    {String(sectionIndex + 1).padStart(2, "0")}
                  </span>
                  {editingSection === section.id ? (
                    <div className={styles.inlineEdit}>
                      <input
                        value={sectionEditTitle}
                        onChange={(event) =>
                          setSectionEditTitle(event.target.value)
                        }
                        autoFocus
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={
                          !sectionEditTitle.trim() || updateSection.isPending
                        }
                        onClick={() =>
                          updateSection.mutate({
                            id: section.id,
                            title: sectionEditTitle.trim(),
                          })
                        }
                      >
                        {t("حفظ", "Save")}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => setEditingSection(null)}
                      >
                        {t("إلغاء", "Cancel")}
                      </button>
                    </div>
                  ) : (
                    <div className={styles.sectionName}>
                      <strong>{section.title}</strong>
                      <span>
                        {sectionLessons.length} {t("درس", "lessons")}
                      </span>
                    </div>
                  )}
                  {!readonly && editingSection !== section.id && (
                    <div className={styles.itemActions}>
                      <button
                        type="button"
                        onClick={() => moveSection(sectionIndex, -1)}
                        disabled={
                          sectionIndex === 0 || reorderSections.isPending
                        }
                        aria-label={t("تحريك القسم لأعلى", "Move section up")}
                      >
                        <StudioIcon name="up" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSection(sectionIndex, 1)}
                        disabled={
                          sectionIndex === sections.length - 1 ||
                          reorderSections.isPending
                        }
                        aria-label={t("تحريك القسم لأسفل", "Move section down")}
                      >
                        <StudioIcon name="down" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSection(section.id);
                          setSectionEditTitle(section.title);
                        }}
                        aria-label={t("تعديل القسم", "Edit section")}
                      >
                        <StudioIcon name="edit" />
                      </button>
                      <button
                        type="button"
                        className={styles.dangerAction}
                        onClick={() => {
                          if (
                            window.confirm(
                              t(
                                "سيُنقل ما يحتويه القسم من دروس إلى قائمة غير مصنفة. هل تريد الحذف؟",
                                "Lessons in this section will become unassigned. Delete the section?",
                              ),
                            )
                          )
                            deleteSection.mutate(section.id);
                        }}
                        aria-label={t("حذف القسم", "Delete section")}
                      >
                        <StudioIcon name="trash" />
                      </button>
                    </div>
                  )}
                </header>
                <div className={styles.lessonList}>
                  {sectionLessons.map((lesson, lessonIndex) => (
                    <article className={styles.lessonRow} key={lesson.id}>
                      <span className={styles.lessonType}>
                        <StudioIcon
                          name={
                            lesson.contentType === "video"
                              ? "video"
                              : lesson.contentType === "resource"
                                ? "file"
                                : "link"
                          }
                        />
                      </span>
                      <div>
                        <strong>{lesson.title}</strong>
                        <span>
                          {lesson.durationMinutes} {t("دقيقة", "min")}
                          {" · "}
                          {lesson.contentType === "video"
                            ? t("فيديو", "Video")
                            : lesson.contentType === "article"
                              ? t("مقال", "Article")
                              : t("مصادر", "Resources")}
                          {lesson.downloadableFiles?.length
                            ? ` · ${lesson.downloadableFiles.length} ${t("ملف", "files")}`
                            : ""}
                        </span>
                      </div>
                      <span
                        className={styles.lessonStatus}
                        data-complete={lessonIsComplete(lesson)}
                      >
                        {lessonIsComplete(lesson)
                          ? t("مكتمل", "Complete")
                          : t("ينقصه محتوى", "Content missing")}
                      </span>
                      {!readonly && (
                        <div className={styles.itemActions}>
                          <button
                            type="button"
                            disabled={
                              lessonIndex === 0 || reorderLessons.isPending
                            }
                            onClick={() =>
                              moveLesson(lesson.id, sectionLessons, -1)
                            }
                            aria-label={t(
                              "تحريك الدرس لأعلى",
                              "Move lesson up",
                            )}
                          >
                            <StudioIcon name="up" />
                          </button>
                          <button
                            type="button"
                            disabled={
                              lessonIndex === sectionLessons.length - 1 ||
                              reorderLessons.isPending
                            }
                            onClick={() =>
                              moveLesson(lesson.id, sectionLessons, 1)
                            }
                            aria-label={t(
                              "تحريك الدرس لأسفل",
                              "Move lesson down",
                            )}
                          >
                            <StudioIcon name="down" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingLesson(lesson)}
                            aria-label={t("تعديل الدرس", "Edit lesson")}
                          >
                            <StudioIcon name="edit" />
                          </button>
                          <button
                            type="button"
                            className={styles.dangerAction}
                            onClick={() => {
                              if (
                                window.confirm(
                                  t(
                                    "هل تريد حذف هذا الدرس وملفاته؟",
                                    "Delete this lesson and its files?",
                                  ),
                                )
                              )
                                deleteLesson.mutate(lesson.id);
                            }}
                            aria-label={t("حذف الدرس", "Delete lesson")}
                          >
                            <StudioIcon name="trash" />
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                  {!readonly && (
                    <button
                      type="button"
                      className={styles.addLessonButton}
                      onClick={() => setLessonSection(section.id)}
                    >
                      <StudioIcon name="plus" />
                      {t("إضافة درس", "Add lesson")}
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {(lessonSection || editingLesson) && (
        <LessonEditor
          courseId={courseId}
          sectionId={
            lessonSection ?? editingLesson?.sectionId ?? sections[0]?.id
          }
          lesson={editingLesson}
          onClose={() => {
            setLessonSection(null);
            setEditingLesson(null);
          }}
          onSaved={async () => {
            setLessonSection(null);
            setEditingLesson(null);
            await refresh();
          }}
          t={t}
        />
      )}
    </>
  );
}

function LessonEditor({
  courseId,
  sectionId,
  lesson,
  onClose,
  onSaved,
  t,
}: {
  courseId: string;
  sectionId: string;
  lesson: CourseLesson | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  t: (ar: string, en: string) => string;
}) {
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [description, setDescription] = useState(lesson?.description ?? "");
  const [contentType, setContentType] = useState<CourseLesson["contentType"]>(
    lesson?.contentType ?? "video",
  );
  const [videoUrl, setVideoUrl] = useState(
    lesson?.videoUrl ?? lesson?.videoAssetId ?? "",
  );
  const [articleContent, setArticleContent] = useState(
    lesson?.articleContent ?? "",
  );
  const [resourceUrl, setResourceUrl] = useState(lesson?.resourceUrl ?? "");
  const [externalLinks, setExternalLinks] = useState(
    lesson?.externalLinks?.map((link) => link.url).join("\n") ?? "",
  );
  const [duration, setDuration] = useState(
    String(lesson?.durationMinutes ?? 10),
  );
  const [isPreview, setIsPreview] = useState(Boolean(lesson?.isPreview));
  const [localError, setLocalError] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim())
        throw new Error(t("اكتب عنوان الدرس.", "Enter a lesson title."));
      if (contentType === "video" && !/^https?:\/\//i.test(videoUrl.trim()))
        throw new Error(
          t("أدخل رابط فيديو صحيحًا.", "Enter a valid video URL."),
        );
      if (contentType === "article" && !articleContent.trim())
        throw new Error(t("أضف محتوى المقال.", "Add the article content."));
      if (
        contentType === "resource" &&
        !resourceUrl.trim() &&
        !externalLinks.trim() &&
        !lesson?.downloadableFiles?.length
      )
        throw new Error(
          t(
            "أضف رابطًا أو ملفًا واحدًا على الأقل.",
            "Add at least one link or file.",
          ),
        );
      const payload = {
        sectionId,
        title: title.trim(),
        description: description.trim(),
        contentType,
        videoUrl: contentType === "video" ? videoUrl.trim() : undefined,
        articleContent:
          contentType === "article" ? articleContent.trim() : undefined,
        resourceUrl:
          contentType === "resource" && resourceUrl.trim()
            ? resourceUrl.trim()
            : undefined,
        externalLinks: externalLinks
          .split("\n")
          .map((url) => url.trim())
          .filter(Boolean),
        durationMinutes: Number(duration || 0),
        isPreview,
      };
      if (lesson) {
        return (
          await apiClient.patch(
            `/courses/${courseId}/lessons/${lesson.id}`,
            payload,
          )
        ).data;
      }
      return (await apiClient.post(`/courses/${courseId}/lessons`, payload))
        .data;
    },
    onMutate: () => setLocalError(""),
    onSuccess: onSaved,
    onError: (requestError) =>
      setLocalError(
        requestError instanceof Error
          ? requestError.message
          : apiError(
              requestError,
              t("تعذّر حفظ الدرس.", "Lesson could not be saved."),
            ),
      ),
  });
  return (
    <div
      className={styles.editorOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-editor-title"
    >
      <div className={styles.lessonEditor}>
        <header>
          <div>
            <span>
              {lesson
                ? t("تعديل الدرس", "Edit lesson")
                : t("درس جديد", "New lesson")}
            </span>
            <h2 id="lesson-editor-title">
              {lesson
                ? lesson.title
                : t("أضف محتوى الدرس", "Add lesson content")}
            </h2>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t("إغلاق", "Close")}
          </button>
        </header>
        <div className={styles.lessonForm}>
          <Field label={t("عنوان الدرس", "Lesson title")}>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              data-testid="lesson-title"
            />
          </Field>
          <div className={styles.fieldGrid}>
            <Field label={t("نوع المحتوى", "Content type")}>
              <select
                value={contentType}
                onChange={(event) =>
                  setContentType(
                    event.target.value as CourseLesson["contentType"],
                  )
                }
              >
                <option value="video">{t("فيديو", "Video")}</option>
                <option value="article">{t("مقال نصي", "Article")}</option>
                <option value="resource">
                  {t("ملفات وروابط", "Files and links")}
                </option>
              </select>
            </Field>
            <Field label={t("المدة بالدقائق", "Duration in minutes")}>
              <input
                type="number"
                min={0}
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            </Field>
          </div>
          <Field label={t("وصف مختصر", "Short description")}>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              maxLength={2000}
            />
          </Field>
          {contentType === "video" && (
            <Field
              label={t("رابط الفيديو", "Video URL")}
              hint={t(
                "يدعم روابط HTTPS الآمنة.",
                "Secure HTTPS URLs are supported.",
              )}
            >
              <input
                dir="ltr"
                type="url"
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
                placeholder="https://"
                data-testid="lesson-video-url"
              />
            </Field>
          )}
          {contentType === "article" && (
            <Field label={t("محتوى المقال", "Article content")}>
              <textarea
                value={articleContent}
                onChange={(event) => setArticleContent(event.target.value)}
                rows={10}
                maxLength={20000}
              />
            </Field>
          )}
          {contentType === "resource" && (
            <>
              <Field label={t("رابط المصدر الرئيسي", "Primary resource URL")}>
                <input
                  dir="ltr"
                  type="url"
                  value={resourceUrl}
                  onChange={(event) => setResourceUrl(event.target.value)}
                  placeholder="https://"
                />
              </Field>
              <Field
                label={t("روابط خارجية إضافية", "Additional external links")}
                hint={t("رابط واحد في كل سطر.", "One URL per line.")}
              >
                <textarea
                  dir="ltr"
                  value={externalLinks}
                  onChange={(event) => setExternalLinks(event.target.value)}
                  rows={4}
                  placeholder={"https://example.com\nhttps://example.org"}
                />
              </Field>
            </>
          )}
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={isPreview}
              onChange={(event) => setIsPreview(event.target.checked)}
            />
            <span>
              <strong>
                {t("إتاحة كمعاينة مجانية", "Allow as a free preview")}
              </strong>
              <small>
                {t(
                  "يمكن للطالب مشاهدة هذا الدرس قبل الشراء.",
                  "Students can view this lesson before purchase.",
                )}
              </small>
            </span>
          </label>
          {lesson && (
            <LessonFiles
              courseId={courseId}
              lesson={lesson}
              onChanged={onSaved}
              t={t}
            />
          )}
          {localError && (
            <p className={styles.formError} role="alert">
              {localError}
            </p>
          )}
        </div>
        <footer>
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t("إلغاء", "Cancel")}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            data-testid="save-lesson"
          >
            <StudioIcon name="save" />
            {save.isPending
              ? t("جاري الحفظ…", "Saving…")
              : t("حفظ الدرس", "Save lesson")}
          </button>
        </footer>
      </div>
    </div>
  );
}

function LessonFiles({
  courseId,
  lesson,
  onChanged,
  t,
}: {
  courseId: string;
  lesson: CourseLesson;
  onChanged: () => Promise<void>;
  t: (ar: string, en: string) => string;
}) {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const allowed = [
        "application/pdf",
        "application/zip",
        "application/x-zip-compressed",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "image/jpeg",
        "image/png",
        "text/plain",
      ];
      if (!allowed.includes(file.type))
        throw new Error(
          t(
            "اختر ملف PDF أو ZIP أو Office أو صورة.",
            "Choose a PDF, ZIP, Office, image, or text file.",
          ),
        );
      if (file.size > 20 * 1024 * 1024)
        throw new Error(
          t(
            "يجب ألا يزيد حجم الملف عن 20 ميجابايت.",
            "File size must not exceed 20MB.",
          ),
        );
      const body = new FormData();
      body.append("file", file);
      return (
        await apiClient.post(
          `/courses/${courseId}/lessons/${lesson.id}/files`,
          body,
          {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (event) => {
              if (event.total)
                setProgress(Math.round((event.loaded / event.total) * 100));
            },
          },
        )
      ).data;
    },
    onMutate: () => {
      setError("");
      setProgress(0);
    },
    onSuccess: onChanged,
    onError: (requestError) =>
      setError(
        requestError instanceof Error
          ? requestError.message
          : apiError(
              requestError,
              t("تعذّر رفع الملف.", "File upload failed."),
            ),
      ),
  });
  const remove = useMutation({
    mutationFn: async (fileId: string) =>
      (
        await apiClient.delete(
          `/courses/${courseId}/lessons/${lesson.id}/files/${fileId}`,
        )
      ).data,
    onSuccess: onChanged,
  });
  return (
    <section className={styles.lessonFiles}>
      <div>
        <strong>{t("ملفات قابلة للتنزيل", "Downloadable files")}</strong>
        <span>
          {t(
            "PDF وZIP وملفات Office حتى 20MB.",
            "PDF, ZIP, and Office files up to 20MB.",
          )}
        </span>
      </div>
      {lesson.downloadableFiles?.map((file) => (
        <div className={styles.fileItem} key={file.id}>
          <StudioIcon name="file" />
          <span>
            <strong>{file.name}</strong>
            <small>{(file.size / 1024 / 1024).toFixed(1)} MB</small>
          </span>
          <button
            type="button"
            onClick={() => remove.mutate(file.id)}
            aria-label={t("حذف الملف", "Delete file")}
          >
            <StudioIcon name="trash" />
          </button>
        </div>
      ))}
      <label className={styles.filePicker}>
        <StudioIcon name="plus" />
        <span>
          {upload.isPending
            ? t(`جاري الرفع ${progress}%`, `Uploading ${progress}%`)
            : t("إرفاق ملف", "Attach file")}
        </span>
        <input
          type="file"
          disabled={upload.isPending}
          accept=".pdf,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload.mutate(file);
            event.target.value = "";
          }}
        />
      </label>
      {upload.isPending && (
        <div
          className={styles.uploadProgress}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function MediaStep({
  courseId,
  coverUrl,
  setCoverUrl,
  readonly,
  refresh,
  t,
}: {
  courseId: string;
  coverUrl: string | null;
  setCoverUrl: (url: string | null) => void;
  readonly: boolean;
  refresh: () => Promise<void>;
  t: (ar: string, en: string) => string;
}) {
  const [coverProgress, setCoverProgress] = useState(0);
  const [coverError, setCoverError] = useState("");
  const uploadCover = useMutation({
    mutationFn: async (file: File) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
        throw new Error(
          t(
            "اختر صورة JPG أو PNG أو WebP.",
            "Choose a JPG, PNG, or WebP image.",
          ),
        );
      if (file.size > 5 * 1024 * 1024)
        throw new Error(
          t(
            "يجب ألا يزيد حجم الغلاف عن 5 ميجابايت.",
            "Cover image must not exceed 5MB.",
          ),
        );
      const body = new FormData();
      body.append("media", file);
      return (
        await apiClient.post<{ url: string }>(
          `/courses/${courseId}/media/cover`,
          body,
          {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (event) => {
              if (event.total)
                setCoverProgress(
                  Math.round((event.loaded / event.total) * 100),
                );
            },
          },
        )
      ).data;
    },
    onMutate: () => {
      setCoverProgress(0);
      setCoverError("");
    },
    onSuccess: async (result) => {
      setCoverUrl(result.url);
      await refresh();
    },
    onError: (requestError) =>
      setCoverError(
        requestError instanceof Error
          ? requestError.message
          : apiError(
              requestError,
              t("تعذّر رفع الغلاف.", "Cover upload failed."),
            ),
      ),
  });
  const removeCover = useMutation({
    mutationFn: async () =>
      (await apiClient.delete(`/courses/${courseId}/media/cover`)).data,
    onSuccess: async () => {
      setCoverUrl(null);
      await refresh();
    },
  });
  return (
    <>
      <StepHeading
        eyebrow={t("الخطوة 4", "Step 4")}
        title={t("وسائط الدورة", "Course media")}
        description={t(
          "استخدم غلافًا واضحًا وفيديو تعريفيًا قصيرًا يشرح قيمة الدورة.",
          "Use a clear cover and a short promo video that explains the course value.",
        )}
      />
      <section className={styles.formSection}>
        <div className={styles.sectionTitle}>
          <div>
            <h2>{t("غلاف الدورة", "Course cover")}</h2>
            <p>
              {t(
                "نسبة 16:9، ويفضل 1280×720 بكسل. الحد الأقصى 5MB.",
                "Use 16:9, ideally 1280×720. Maximum 5MB.",
              )}
            </p>
          </div>
          <span>{t("مطلوب", "Required")}</span>
        </div>
        <div className={styles.coverStudio}>
          <div className={styles.coverPreview}>
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt={t("معاينة غلاف الدورة", "Course cover preview")}
              />
            ) : (
              <span>
                <StudioIcon name="preview" />
                MRH Academy
              </span>
            )}
          </div>
          {!readonly && (
            <div className={styles.coverActions}>
              <label className="btn-secondary">
                <StudioIcon name="plus" />
                {coverUrl
                  ? t("استبدال الغلاف", "Replace cover")
                  : t("رفع الغلاف", "Upload cover")}
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  disabled={uploadCover.isPending}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadCover.mutate(file);
                    event.target.value = "";
                  }}
                  data-testid="course-cover-input"
                />
              </label>
              {coverUrl && (
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={removeCover.isPending}
                  onClick={() => removeCover.mutate()}
                >
                  <StudioIcon name="trash" />
                  {t("إزالة", "Remove")}
                </button>
              )}
              {uploadCover.isPending && (
                <div
                  className={styles.uploadProgress}
                  role="progressbar"
                  aria-valuenow={coverProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${coverProgress}%` }} />
                </div>
              )}
              {coverError && (
                <p className={styles.formError} role="alert">
                  {coverError}
                </p>
              )}
            </div>
          )}
        </div>
      </section>
      <section className={styles.formSection}>
        <div className={styles.sectionTitle}>
          <div>
            <h2>{t("الفيديو التعريفي", "Promo video")}</h2>
            <p>
              {t(
                "عرّف بالدورة والمدرّس والنتيجة المتوقعة خلال دقيقتين تقريبًا.",
                "Introduce the course, instructor, and expected result in about two minutes.",
              )}
            </p>
          </div>
          <span>{t("مطلوب", "Required")}</span>
        </div>
        <VideoUploader
          title={t("فيديو نظرة عامة على الدورة", "Course overview video")}
          description={t(
            "MP4 أو WebM أو MOV حتى 250MB، مع إمكانية إضافة ترجمة.",
            "MP4, WebM, or MOV up to 250MB, with optional captions.",
          )}
          uploadEndpoint={`/courses/${courseId}/media/preview`}
          statusEndpoint={`/courses/${courseId}/media/preview/status`}
          deleteEndpoint={`/courses/${courseId}/media/preview`}
          captionsEndpoint={`/courses/${courseId}/media/preview/captions`}
          captionDeleteEndpoint={(language) =>
            `/courses/${courseId}/media/preview/captions/${encodeURIComponent(language)}`
          }
          uploadField="media"
          readonly={readonly}
          onChange={refresh}
          testId="course-video-uploader"
        />
      </section>
    </>
  );
}

function PricingStep({
  draft,
  update,
  readonly,
  t,
  error,
  markVisited,
}: {
  draft: CourseDraftForm;
  update: <K extends keyof CourseDraftForm>(
    key: K,
    value: CourseDraftForm[K],
  ) => void;
  readonly: boolean;
  t: (ar: string, en: string) => string;
  error?: string;
  markVisited: () => void;
}) {
  return (
    <>
      <StepHeading
        eyebrow={t("الخطوة 5", "Step 5")}
        title={t("تسعير الدورة", "Course pricing")}
        description={t(
          "حدّد السعر النهائي الذي يراه الطالب. تتم عمليات الشراء الحالية بالدولار.",
          "Set the final student price. Current course purchases are processed in USD.",
        )}
      />
      <section className={styles.formSection}>
        <div className={styles.sectionTitle}>
          <div>
            <h2>{t("السعر الأساسي", "Base price")}</h2>
            <p>
              {t(
                "يمكنك اختيار صفر لنشر دورة مجانية.",
                "Use zero to offer a free course.",
              )}
            </p>
          </div>
          <span>USD</span>
        </div>
        <div className={styles.priceField}>
          <span>$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={draft.price}
            onChange={(event) => update("price", event.target.value)}
            onBlur={markVisited}
            disabled={readonly}
            data-testid="course-price"
          />
        </div>
        {error && (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        )}
        <div className={styles.priceNote}>
          <StudioIcon name="check" />
          <p>
            <strong>
              {t("سلوك الشراء محفوظ", "Purchase behavior is preserved")}
            </strong>
            <span>
              {t(
                "يُخصم السعر من محفظة الطالب بعد تأكيد الخادم، وتبقى قواعد الإحالة والعمولة كما هي.",
                "The server confirms wallet debit, referrals, and commissions using the existing purchase flow.",
              )}
            </span>
          </p>
        </div>
      </section>
    </>
  );
}

function ReviewStep({
  course,
  draft,
  readiness,
  sections,
  lessons,
  ready,
  readonly,
  submitting,
  onPreview,
  onSubmit,
  t,
}: {
  course: Course;
  draft: CourseDraftForm;
  readiness: Readiness;
  sections: CourseSection[];
  lessons: CourseLesson[];
  ready: boolean;
  readonly: boolean;
  submitting: boolean;
  onPreview: () => void;
  onSubmit: () => void;
  t: (ar: string, en: string) => string;
}) {
  const labelByKey: Record<string, string> = {
    basics: t("أساسيات الدورة مكتملة", "Course basics complete"),
    audience: t("الجمهور والأهداف مكتملة", "Audience and outcomes complete"),
    curriculum: t(
      "المنهج يحتوي أقسامًا ودروسًا مكتملة",
      "Curriculum has complete sections and lessons",
    ),
    media: t(
      "الغلاف والفيديو التعريفي جاهزان",
      "Cover and promo video are ready",
    ),
    pricing: t("السعر صالح", "Pricing is valid"),
    schedule: t(
      "جدول الدفعة وسعتها صالحان",
      "Cohort schedule and capacity are valid",
    ),
  };
  return (
    <>
      <StepHeading
        eyebrow={t("الخطوة الأخيرة", "Final step")}
        title={
          readonly
            ? t("تفاصيل الإرسال", "Submission details")
            : t("راجع دورتك وأرسلها", "Review and submit your course")
        }
        description={t(
          "تحقق من تجربة الطالب قبل إرسال الدورة إلى فريق الأكاديمية.",
          "Check the student experience before sending the course to the academy team.",
        )}
      />
      <section className={styles.reviewHero} data-ready={ready || readonly}>
        <span>
          <StudioIcon name={ready || readonly ? "check" : "lock"} />
        </span>
        <div>
          <strong>
            {readonly
              ? course.status === "active"
                ? t("الدورة منشورة", "Course is published")
                : t("الدورة قيد المراجعة", "Course is under review")
              : ready
                ? t("دورتك جاهزة للإرسال", "Your course is ready to submit")
                : t(
                    "لا تزال هناك عناصر ناقصة",
                    "A few items are still missing",
                  )}
          </strong>
          <p>
            {t(
              `${sections.length} أقسام · ${lessons.length} دروس · ${readiness.completed} من ${readiness.total} متطلبات مؤكدة من الخادم`,
              `${sections.length} sections · ${lessons.length} lessons · ${readiness.completed} of ${readiness.total} server checks complete`,
            )}
          </p>
        </div>
      </section>
      <section className={styles.formSection}>
        <div className={styles.sectionTitle}>
          <div>
            <h2>{t("قائمة جاهزية النشر", "Publishing checklist")}</h2>
            <p>
              {t(
                "يعيد الخادم التحقق من كل بند عند الإرسال.",
                "The server validates every item again on submission.",
              )}
            </p>
          </div>
        </div>
        <ul className={styles.reviewChecklist}>
          {readiness.items.map((item) => (
            <li key={item.key} data-complete={item.complete}>
              <span>
                <StudioIcon name={item.complete ? "check" : "lock"} />
              </span>
              <strong>{labelByKey[item.key] ?? item.label}</strong>
              <small>
                {item.complete
                  ? t("مكتمل", "Complete")
                  : t("غير مكتمل", "Incomplete")}
              </small>
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.reviewSummary}>
        <div>
          <span>{t("الدورة", "Course")}</span>
          <strong>{draft.title}</strong>
          <small>{draft.subtitle}</small>
        </div>
        <div>
          <span>{t("السعر", "Price")}</span>
          <strong>${Number(draft.price || 0).toFixed(2)}</strong>
          <small>{draft.category}</small>
        </div>
        <div>
          <span>{t("المحتوى", "Content")}</span>
          <strong>
            {lessons.length} {t("درس", "lessons")}
          </strong>
          <small>
            {lessons.reduce(
              (total, lesson) => total + lesson.durationMinutes,
              0,
            )}{" "}
            {t("دقيقة", "minutes")}
          </small>
        </div>
      </section>
      <div className={styles.reviewActions}>
        <button type="button" className="btn-secondary" onClick={onPreview}>
          <StudioIcon name="preview" />
          {t("معاينة صفحة الطالب", "Preview student page")}
        </button>
        {!readonly && (
          <button
            type="button"
            className="btn-primary"
            disabled={!ready || submitting}
            onClick={onSubmit}
          >
            <StudioIcon name="send" />
            {submitting
              ? t("جاري الإرسال…", "Submitting…")
              : t("إرسال للمراجعة", "Submit for review")}
          </button>
        )}
      </div>
    </>
  );
}
