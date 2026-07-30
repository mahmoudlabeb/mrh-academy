"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";
import { VideoUploader } from "@/components/shared/VideoUploader";

type CourseStatus = "pending" | "approved" | "rejected";

type Course = {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  price: number;
  status: CourseStatus;
  referralCode: string;
  updatedAt?: string;
  courseType?: "recorded" | "live";
  subtitle?: string | null;
  learningOutcomes?: string[];
  requirements?: string | null;
  targetAudience?: string | null;
  language?: string | null;
  level?: string | null;
  capacity?: number | null;
  cohortStartAt?: string | null;
  cohortEndAt?: string | null;
  isDraft?: boolean;
};

type CourseLesson = {
  id: string;
  title: string;
  durationMinutes: number;
  lessonOrder: number;
};

type CourseDraft = {
  title: string;
  description: string;
  price: string;
  thumbnailUrl: string;
  courseType: "recorded" | "live";
  subtitle: string;
  learningOutcomes: string[];
  requirements: string;
  targetAudience: string;
  language: string;
  level: string;
  capacity: string;
  cohortStartAt: string;
  cohortEndAt: string;
};

type StudioStep =
  | "learners"
  | "structure"
  | "curriculum"
  | "landing"
  | "pricing"
  | "promotions";

const EMPTY_DRAFT: CourseDraft = {
  title: "",
  description: "",
  price: "",
  thumbnailUrl: "",
  courseType: "recorded",
  subtitle: "",
  learningOutcomes: [],
  requirements: "",
  targetAudience: "",
  language: "Arabic",
  level: "Beginner",
  capacity: "12",
  cohortStartAt: "",
  cohortEndAt: "",
};

function getApiError(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response
  ) {
    const data = error.response.data;
    if (typeof data === "object" && data !== null && "message" in data) {
      const message = data.message;
      if (Array.isArray(message)) return message.join(" ");
      if (typeof message === "string") return message;
    }
  }
  return fallback;
}

function statusCopy(
  status: CourseStatus,
  t: (ar: string, en: string) => string,
) {
  if (status === "approved") return t("معتمدة", "Approved");
  if (status === "rejected") return t("تحتاج تعديلاً", "Changes required");
  return t("قيد المراجعة", "Pending review");
}

export default function CourseStudio() {
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [filter, setFilter] = useState<
    "all" | "recorded" | "live" | "pending" | "drafts"
  >("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const coursesQuery = useQuery({
    queryKey: ["my-courses"],
    queryFn: async () =>
      (await apiClient.get<Course[]>("/courses/my/courses")).data,
  });

  const courses = coursesQuery.data ?? [];
  const visibleCourses = courses.filter((course) => {
    if (filter === "recorded")
      return course.courseType !== "live" && !course.isDraft;
    if (filter === "live") return course.courseType === "live";
    if (filter === "pending") return course.status === "pending";
    if (filter === "drafts") return Boolean(course.isDraft);
    return true;
  });
  const pendingCount = courses.filter(
    (course) => course.status === "pending",
  ).length;
  const liveCount = courses.filter(
    (course) => course.courseType === "live",
  ).length;
  const draftCount = courses.filter((course) => course.isDraft).length;
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  function courseLink(course: Course) {
    return `${origin}/${lang}/courses/${course.id}?ref=${encodeURIComponent(course.referralCode)}`;
  }

  async function copy(course: Course) {
    await navigator.clipboard.writeText(courseLink(course));
    setCopiedId(course.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  }

  return (
    <section className="course-manager" aria-labelledby="course-manager-title">
      <header className="course-manager__hero">
        <div>
          <p className="course-manager__kicker">
            {t("استوديو محتوى المدرّس", "Instructor content studio")}
          </p>
          <h1 id="course-manager-title">
            {t(
              "استوديو الدورات وإدارة المحتوى",
              "Course Studio & Content Manager",
            )}
          </h1>
          <p>
            {t(
              "أنشئ دورات فيديو مسجلة، وتابع مراجعة الأكاديمية، وشارك روابط البيع الموثّقة.",
              "Build recorded video courses, track academy review, and share verified selling links.",
            )}
          </p>
        </div>
        <div className="course-manager__actions">
          <Link
            href={`/${lang}/teach/courses/new/studio`}
            className="btn-primary"
          >
            <span aria-hidden="true">＋</span>
            {t("إضافة دورة مسجلة", "Add Recorded Course")}
          </Link>
          <span className="course-manager__disabled-action">
            <button
              type="button"
              className="course-manager__cohort"
              onClick={() =>
                window.location.assign(
                  `/${lang}/teach/courses/new/studio?type=live`,
                )
              }
              aria-describedby="cohort-capability-note"
            >
              <span aria-hidden="true">◉</span>
              {t("جدولة فصل جماعي", "Schedule Live Cohort")}
            </button>
            <small id="cohort-capability-note">
              {t("يتطلب دعماً من الخادم", "Requires backend support")}
            </small>
          </span>
        </div>
      </header>

      <dl className="course-manager__ledger">
        <Metric
          label={t("الدورات المسجلة", "Recorded courses")}
          value={coursesQuery.isLoading ? "…" : String(courses.length)}
          tone="signal"
        />
        <Metric
          label={t("الفصول الجماعية", "Live cohort classes")}
          value={coursesQuery.isLoading ? "…" : String(liveCount)}
          note={t("غير مدعومة حالياً", "Backend required")}
          tone="ember"
        />
        <Metric
          label={t("قيد المراجعة", "Pending review")}
          value={coursesQuery.isLoading ? "…" : String(pendingCount)}
          tone="neutral"
        />
        <Metric
          label={t("المسودات النشطة", "Active drafts")}
          value={coursesQuery.isLoading ? "…" : String(draftCount)}
          note={t("حفظ المسودات غير متاح", "Draft API required")}
          tone="neutral"
        />
      </dl>

      <div
        className="course-manager__filters"
        aria-label={t("تصفية الدورات", "Filter courses")}
      >
        <button
          type="button"
          className={filter === "all" ? "active" : undefined}
          onClick={() => setFilter("all")}
        >
          {t("الكل", "All")} ({courses.length})
        </button>
        <button
          type="button"
          className={filter === "recorded" ? "active" : undefined}
          onClick={() => setFilter("recorded")}
        >
          {t("مسجلة", "Recorded")} ({courses.length})
        </button>
        <button
          type="button"
          className={filter === "pending" ? "active" : undefined}
          onClick={() => setFilter("pending")}
        >
          {t("قيد المراجعة", "Pending review")} ({pendingCount})
        </button>
        <button
          type="button"
          className={filter === "live" ? "active" : undefined}
          onClick={() => setFilter("live")}
        >
          {t("مباشرة", "Live")} ({liveCount})
        </button>
        <span>
          <button
            type="button"
            className={filter === "drafts" ? "active" : undefined}
            onClick={() => setFilter("drafts")}
          >
            {t("المسودات", "Drafts")} (—)
          </button>
          <small id="draft-filter-note">
            {t("واجهة المسودات غير متاحة", "Draft API unavailable")}
          </small>
        </span>
      </div>

      {coursesQuery.isLoading ? (
        <div
          className="course-manager__grid"
          aria-label={t("جاري تحميل الدورات", "Loading courses")}
        >
          <div className="course-card course-card--loading skeleton" />
          <div className="course-card course-card--loading skeleton" />
          <div className="course-card course-card--loading skeleton" />
        </div>
      ) : coursesQuery.isError ? (
        <div className="course-manager__state" role="alert">
          <strong>
            {t(
              "تعذّر تحميل استوديو الدورات",
              "Course studio could not be loaded",
            )}
          </strong>
          <p>
            {t(
              "لم يتم تغيير أي بيانات. حاول الاتصال بالخادم مرة أخرى.",
              "No data was changed. Reconnect to the server and try again.",
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
        <div className="course-manager__state">
          <span className="course-manager__empty-mark" aria-hidden="true">
            ▤
          </span>
          <strong>
            {filter === "pending"
              ? t(
                  "لا توجد دورات تنتظر المراجعة",
                  "No courses are awaiting review",
                )
              : t("ابدأ أول دورة مسجلة", "Start your first recorded course")}
          </strong>
          <p>
            {t(
              "ستنتقل إلى الاستوديو المنظّم خطوة بخطوة قبل إرسال الدورة للمراجعة.",
              "The guided studio keeps the supported course fields together before review submission.",
            )}
          </p>
          {filter !== "pending" && (
            <Link
              href={`/${lang}/teach/courses/new/studio`}
              className="btn-primary"
            >
              {t("فتح الاستوديو", "Open Studio")}
            </Link>
          )}
        </div>
      ) : (
        <div className="course-manager__grid">
          {visibleCourses.map((course, index) => (
            <article className="course-card" key={course.id}>
              <div className="course-card__image">
                {course.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={course.thumbnailUrl} alt="" />
                ) : (
                  <div className="course-card__placeholder" aria-hidden="true">
                    <span>MRH</span>
                    <i />
                  </div>
                )}
                <span className="course-card__type">
                  {t("فيديو مسجل", "Pre-recorded")}
                </span>
                <span
                  className={`course-card__status course-card__status--${course.status}`}
                >
                  {statusCopy(course.status, t)}
                </span>
              </div>
              <div className="course-card__body">
                <span className="course-card__folio">
                  {String(index + 1).padStart(2, "0")} /{" "}
                  {t("سجل الدورة", "Course record")}
                </span>
                <h2>{course.title}</h2>
                <p>{course.description}</p>
                <div className="course-card__facts">
                  <span>
                    {t("الدروس", "Lessons")}:{" "}
                    <b>{t("تُحسب داخل الاستوديو", "Open studio to inspect")}</b>
                  </span>
                  <strong>${Number(course.price).toFixed(2)}</strong>
                </div>
              </div>
              <footer className="course-card__footer">
                <Link
                  className="btn-secondary"
                  href={`/${lang}/teach/courses/${course.id}/studio`}
                >
                  {t("فحص الدورة", "Inspect course")}
                </Link>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => copy(course)}
                >
                  {copiedId === course.id
                    ? t("تم نسخ الرابط", "Link copied")
                    : t("نسخ رابط البيع", "Copy selling link")}
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone: "signal" | "ember" | "neutral";
}) {
  return (
    <div data-tone={tone}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {note && <small>{note}</small>}
    </div>
  );
}

export function CourseStudioEditor({ courseId }: { courseId?: string }) {
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<StudioStep>(
    courseId ? "curriculum" : "structure",
  );
  const studioNavigationRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    const activeItem =
      studioNavigationRef.current?.querySelector<HTMLElement>("button.active");
    activeItem?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [lang, step]);
  const [draft, setDraft] = useState<CourseDraft>(EMPTY_DRAFT);
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof CourseDraft, string>>
  >({});
  const [validationSummary, setValidationSummary] = useState<string | null>(
    null,
  );

  const coursesQuery = useQuery({
    queryKey: ["my-courses"],
    queryFn: async () =>
      (await apiClient.get<Course[]>("/courses/my/courses")).data,
    enabled: Boolean(courseId),
  });
  const existingCourse = coursesQuery.data?.find(
    (course) => course.id === courseId,
  );
  const lessonsQuery = useQuery({
    queryKey: ["course-lessons", courseId],
    queryFn: async () =>
      (await apiClient.get<CourseLesson[]>(`/courses/${courseId}/lessons`))
        .data,
    enabled: Boolean(courseId),
  });

  const activeDraft = useMemo<CourseDraft>(() => {
    if (!existingCourse || touched) return draft;
    return {
      title: existingCourse.title,
      description: existingCourse.description,
      price: String(existingCourse.price),
      thumbnailUrl: existingCourse.thumbnailUrl ?? "",
      courseType: existingCourse.courseType ?? "recorded",
      subtitle: existingCourse.subtitle ?? "",
      learningOutcomes: existingCourse.learningOutcomes ?? [],
      requirements: Array.isArray(existingCourse.requirements)
        ? existingCourse.requirements.join(", ")
        : (existingCourse.requirements ?? ""),
      targetAudience: Array.isArray(existingCourse.targetAudience)
        ? existingCourse.targetAudience.join(", ")
        : (existingCourse.targetAudience ?? ""),
      language: existingCourse.language ?? "Arabic",
      level: existingCourse.level ?? "Beginner",
      capacity: String(existingCourse.capacity ?? 12),
      cohortStartAt: existingCourse.cohortStartAt
        ? existingCourse.cohortStartAt.slice(0, 16)
        : "",
      cohortEndAt: existingCourse.cohortEndAt
        ? existingCourse.cohortEndAt.slice(0, 16)
        : "",
    };
  }, [draft, existingCourse, touched]);

  const createCourse = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<Course>("/courses/drafts", {
          courseType: activeDraft.courseType,
        })
      ).data,
    onSuccess: async (course) => {
      await queryClient.invalidateQueries({ queryKey: ["my-courses"] });
      router.replace(`/${lang}/teach/courses/${course.id}/studio?created=1`);
    },
  });

  const saveDraft = useMutation({
    mutationFn: async () => {
      if (!courseId) throw new Error("Create a draft first.");
      return (
        await apiClient.patch<Course>(`/courses/${courseId}`, {
          title: activeDraft.title.trim(),
          description: activeDraft.description.trim(),
          price: Number(activeDraft.price || 0),
          thumbnailUrl: activeDraft.thumbnailUrl.trim() || undefined,
          courseType: activeDraft.courseType,
          subtitle: activeDraft.subtitle.trim() || undefined,
          learningOutcomes: activeDraft.learningOutcomes,
          requirements: activeDraft.requirements.trim()
            ? activeDraft.requirements
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
            : undefined,
          targetAudience: activeDraft.targetAudience.trim()
            ? activeDraft.targetAudience
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
            : undefined,
          language: activeDraft.language,
          level: activeDraft.level,
          capacity: Number(activeDraft.capacity || 12),
          cohortStartAt: activeDraft.cohortStartAt || undefined,
          cohortEndAt: activeDraft.cohortEndAt || undefined,
        })
      ).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-courses"] });
      setTouched(false);
    },
  });

  const submitForReview = useMutation({
    mutationFn: async () => {
      if (!courseId) throw new Error("Create a draft first.");
      return (await apiClient.post<Course>(`/courses/${courseId}/submit`)).data;
    },
    onSuccess: async (course) => {
      await queryClient.invalidateQueries({ queryKey: ["my-courses"] });
      router.replace(`/${lang}/teach/courses/${course.id}/studio?submitted=1`);
    },
  });

  const readonly = Boolean(
    courseId && existingCourse && !existingCourse.isDraft,
  );
  const steps: Array<{
    id: StudioStep;
    section: string;
    label: string;
    supported: boolean;
  }> = [
    {
      id: "learners",
      section: t("خطّط لدورتك", "Plan your course"),
      label: t("المتعلمون المستهدفون", "Intended learners"),
      supported: true,
    },
    {
      id: "structure",
      section: t("خطّط لدورتك", "Plan your course"),
      label: t("هيكل الدورة", "Course structure"),
      supported: true,
    },
    {
      id: "curriculum",
      section: t("أنشئ المحتوى", "Create your content"),
      label: t("منشئ المنهج", "Curriculum builder"),
      supported: Boolean(courseId),
    },
    {
      id: "landing",
      section: t("انشر دورتك", "Publish your course"),
      label: t("صفحة العرض والغلاف", "Landing page & banner"),
      supported: !readonly,
    },
    {
      id: "pricing",
      section: t("انشر دورتك", "Publish your course"),
      label: t("السعر والامتثال", "Pricing & compliance"),
      supported: !readonly,
    },
    {
      id: "promotions",
      section: t("انشر دورتك", "Publish your course"),
      label: t("العروض وروابط الإحالة", "Promotions & referral links"),
      supported: Boolean(existingCourse?.referralCode),
    },
  ];

  function update<K extends keyof CourseDraft>(key: K, value: CourseDraft[K]) {
    setTouched(true);
    setDraft({ ...activeDraft, [key]: value });
    setErrors((current) => ({ ...current, [key]: undefined }));
    setValidationSummary(null);
  }

  function validate() {
    const next: typeof errors = {};
    if (activeDraft.title.trim().length < 3)
      next.title = t(
        "اكتب عنواناً من 3 أحرف على الأقل.",
        "Enter a title of at least 3 characters.",
      );
    if (activeDraft.description.trim().length < 20)
      next.description = t(
        "اكتب وصفاً واضحاً من 20 حرفاً على الأقل.",
        "Enter a clear description of at least 20 characters.",
      );
    if (
      !Number.isFinite(Number(activeDraft.price)) ||
      Number(activeDraft.price) < 0
    )
      next.price = t("أدخل سعراً صحيحاً.", "Enter a valid price.");
    if (
      activeDraft.thumbnailUrl &&
      !/^https?:\/\//i.test(activeDraft.thumbnailUrl)
    )
      next.thumbnailUrl = t(
        "اكتب رابط صورة يبدأ بـ http أو https.",
        "Enter an image URL beginning with http or https.",
      );
    setErrors(next);
    const invalidFields = Object.keys(next) as Array<keyof CourseDraft>;
    if (invalidFields.length === 0) {
      setValidationSummary(null);
      return true;
    }

    const firstField = invalidFields[0];
    const firstStep: StudioStep =
      firstField === "price"
        ? "pricing"
        : firstField === "thumbnailUrl"
          ? "landing"
          : "structure";
    setStep(firstStep);
    setValidationSummary(
      t(
        `يرجى تصحيح ${invalidFields.length} من الحقول المطلوبة قبل الإرسال.`,
        `Correct ${invalidFields.length} required ${invalidFields.length === 1 ? "field" : "fields"} before submitting.`,
      ),
    );
    window.setTimeout(() => {
      document.getElementById(`studio-${firstStep}-${firstField}`)?.focus();
    }, 0);
    return false;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readonly) return;
    if (!courseId) {
      if (validate()) createCourse.mutate();
      return;
    }
    if (validate()) submitForReview.mutate();
  }

  if (courseId && coursesQuery.isLoading) {
    return (
      <div
        className="course-studio-loading skeleton"
        aria-label={t("جاري تحميل الاستوديو", "Loading studio")}
      />
    );
  }

  if (courseId && (coursesQuery.isError || !existingCourse)) {
    return (
      <section className="course-manager__state" role="alert">
        <strong>
          {t("تعذّر فتح هذه الدورة", "This course could not be opened")}
        </strong>
        <p>
          {t(
            "لم يغيّر الخادم أي بيانات.",
            "The server did not change any data.",
          )}
        </p>
        <Link className="btn-secondary" href={`/${lang}/teach/courses`}>
          {t("العودة للدورات", "Back to courses")}
        </Link>
      </section>
    );
  }

  return (
    <form className="course-studio" onSubmit={submit} noValidate>
      <header className="course-studio__bar">
        <Link href={`/${lang}/teach/courses`} className="btn-ghost">
          <span aria-hidden="true">←</span>
          {t("الخروج من الاستوديو", "Exit Studio")}
        </Link>
        <div className="course-studio__identity">
          <span aria-hidden="true">✣</span>
          <strong>
            {activeDraft.title || t("دورة بلا عنوان", "Untitled course")}
          </strong>
          <small>
            {existingCourse
              ? statusCopy(existingCourse.status, t)
              : t("إعداد محلي", "Local setup")}
          </small>
        </div>
        <div className="course-studio__save">
          <span
            className={`course-studio__save-state${existingCourse ? " confirmed" : ""}`}
          >
            {existingCourse
              ? t("البيانات مؤكدة من الخادم", "Server-confirmed data")
              : t("لم تُحفظ بعد", "Not saved yet")}
          </span>
          <span className="course-studio__disabled-save">
            <button
              type="button"
              className="btn-secondary"
              disabled={
                !courseId || readonly || saveDraft.isPending || !touched
              }
              onClick={() => saveDraft.mutate()}
              aria-describedby="save-draft-capability-note"
            >
              {t("حفظ المسودة", "Save Draft")}
            </button>
            <small id="save-draft-capability-note">
              {t("مسودة مؤكدة من الخادم", "Server-backed draft")}
            </small>
          </span>
          <button
            type="submit"
            className="btn-primary"
            disabled={
              readonly || createCourse.isPending || submitForReview.isPending
            }
          >
            {createCourse.isPending
              ? t("يرسل للخادم…", "Sending to server…")
              : readonly
                ? t(
                    "التعديل يحتاج دعماً من الخادم",
                    "Editing requires backend support",
                  )
                : t("إنشاء وإرسال للمراجعة", "Create & Submit for Review")}
          </button>
        </div>
      </header>

      <div className="course-studio__layout">
        <aside
          ref={studioNavigationRef}
          className="course-studio__nav"
          aria-label={t("خطوات إعداد الدورة", "Course setup steps")}
        >
          {Array.from(new Set(steps.map((item) => item.section))).map(
            (section) => (
              <section key={section}>
                <h2>{section}</h2>
                {steps
                  .filter((item) => item.section === section)
                  .map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={step === item.id ? "active" : undefined}
                      onClick={() => setStep(item.id)}
                    >
                      <span
                        className="course-studio__step-number"
                        aria-hidden="true"
                      >
                        {String(
                          steps.findIndex(
                            (stepItem) => stepItem.id === item.id,
                          ) + 1,
                        ).padStart(2, "0")}
                      </span>
                      <span>{item.label}</span>
                      {!item.supported && (
                        <small>{t("غير متاح", "Unavailable")}</small>
                      )}
                    </button>
                  ))}
              </section>
            ),
          )}
        </aside>

        <main className="course-studio__workspace">
          <div
            className="course-studio__progress"
            aria-label={t(
              "موضع القسم في استوديو الدورة",
              "Course studio section position",
            )}
          >
            <span>
              {String(steps.findIndex((item) => item.id === step) + 1).padStart(
                2,
                "0",
              )}
            </span>
            <div>
              <small>
                {t(
                  `القسم ${steps.findIndex((item) => item.id === step) + 1} من ${steps.length}`,
                  `Section ${steps.findIndex((item) => item.id === step) + 1} of ${steps.length}`,
                )}
              </small>
              <strong>{steps.find((item) => item.id === step)?.label}</strong>
            </div>
            <i aria-hidden="true">
              <b
                style={{
                  insetInlineStart: `${(steps.findIndex((item) => item.id === step) / (steps.length - 1)) * 100}%`,
                }}
              />
            </i>
          </div>
          {validationSummary && (
            <div
              className="studio-validation-summary"
              role="alert"
              aria-live="assertive"
            >
              <strong>
                {t("الدورة غير جاهزة للإرسال", "Course is not ready to submit")}
              </strong>
              <p>{validationSummary}</p>
            </div>
          )}
          {createCourse.isError && (
            <div className="studio-notice studio-notice--error" role="alert">
              <strong>
                {t("لم يتم إنشاء الدورة", "Course was not created")}
              </strong>
              <p>
                {getApiError(
                  createCourse.error,
                  t(
                    "راجع البيانات ثم حاول مرة أخرى.",
                    "Review the data and try again.",
                  ),
                )}
              </p>
            </div>
          )}
          {!existingCourse && (
            <div className="studio-notice">
              <strong>
                {t(
                  "حفظ المسودة يحتاج إلى واجهة خادم",
                  "Draft persistence needs a server endpoint",
                )}
              </strong>
              <p>
                {t(
                  "تبقى القيم في هذه الصفحة فقط. لن تظهر رسالة نجاح إلا بعد أن يؤكد الخادم إنشاء الدورة وإرسالها للمراجعة.",
                  "Values remain on this page only. Success is shown only after the server confirms course creation and review submission.",
                )}
              </p>
            </div>
          )}
          {readonly && (
            <div className="studio-notice">
              <strong>{t("وضع الفحص فقط", "Inspection mode")}</strong>
              <p>
                {t(
                  "يعرض الاستوديو البيانات المؤكدة، لكن تعديل دورة قائمة يحتاج إلى نقطة تحديث من الخادم.",
                  "This studio shows confirmed data. Updating an existing course requires a server update endpoint.",
                )}
              </p>
            </div>
          )}

          {step === "learners" && (
            <LearnersStepV2
              t={t}
              outcomes={activeDraft.learningOutcomes}
              onChange={(learningOutcomes) =>
                update("learningOutcomes", learningOutcomes)
              }
            />
          )}
          {step === "structure" && (
            <StructureStep
              draft={activeDraft}
              update={update}
              errors={errors}
              readonly={readonly}
              t={t}
            />
          )}
          {step === "curriculum" && (
            <CurriculumStep
              lessons={lessonsQuery.data ?? []}
              loading={lessonsQuery.isLoading}
              hasCourse={Boolean(courseId)}
              t={t}
            />
          )}
          {step === "landing" && (
            <LandingStep
              draft={activeDraft}
              update={update}
              errors={errors}
              readonly={readonly}
              courseId={courseId}
              t={t}
            />
          )}
          {step === "pricing" && (
            <PricingStep
              draft={activeDraft}
              update={update}
              error={errors.price}
              readonly={readonly}
              t={t}
            />
          )}
          {step === "promotions" && (
            <PromotionsStep course={existingCourse} lang={lang} t={t} />
          )}
        </main>
      </div>
    </form>
  );
}

function StudioHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="studio-step__heading">
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LearnersStep({ t }: { t: (ar: string, en: string) => string }) {
  return (
    <>
      <StudioHeading
        title={t("المتعلمون المستهدفون", "Intended Learners")}
        description={t(
          "حدّد نتائج التعلّم والمتطلبات الأساسية للطلاب المحتملين.",
          "Define learning goals and prerequisites for prospective students.",
        )}
      />
      <section className="studio-panel">
        <div className="studio-panel__title">
          <div>
            <h2>
              {t(
                "ماذا سيتعلم الطلاب؟",
                "What will students learn in your course?",
              )}
            </h2>
            <p>
              {t(
                "هذه البيانات تحتاج إلى دعم جديد من الخادم قبل حفظها.",
                "These outcomes require a new server contract before they can be saved.",
              )}
            </p>
          </div>
          <span className="studio-capability">
            {t("دعم الخادم مطلوب", "Backend support required")}
          </span>
        </div>
        <div className="studio-disabled-row">
          <input
            disabled
            placeholder={t(
              "مثال: إتقان محادثات يومية عملية…",
              "e.g. Master practical everyday conversation…",
            )}
          />
          <button type="button" disabled>
            ＋ {t("إضافة هدف", "Add Goal")}
          </button>
        </div>
      </section>
    </>
  );
}

function LearnersStepV2({
  t,
  outcomes,
  onChange,
}: {
  t: (ar: string, en: string) => string;
  outcomes: string[];
  onChange: (outcomes: string[]) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <>
      <StudioHeading
        title={t("نتائج التعلم", "Learning outcomes")}
        description={t(
          "ما الذي سيتعلمه الطالب؟",
          "Tell students what they will be able to do.",
        )}
      />
      <section className="studio-panel studio-form">
        <ul className="studio-outcome-list">
          {outcomes.map((outcome, index) => (
            <li key={`${outcome}-${index}`}>
              <span>{outcome}</span>
              <button
                type="button"
                onClick={() => onChange(outcomes.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="studio-disabled-row">
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={t(
              "مثال: التحدث بثقة",
              "e.g. Speak confidently in everyday situations",
            )}
          />
          <button
            type="button"
            disabled={!value.trim()}
            onClick={() => {
              onChange([...outcomes, value.trim()]);
              setValue("");
            }}
          >
            + {t("إضافة نتيجة", "Add outcome")}
          </button>
        </div>
      </section>
    </>
  );
}

function StructureStep({
  draft,
  update,
  errors,
  readonly,
  t,
}: {
  draft: CourseDraft;
  update: <K extends keyof CourseDraft>(key: K, value: CourseDraft[K]) => void;
  errors: Partial<Record<keyof CourseDraft, string>>;
  readonly: boolean;
  t: (ar: string, en: string) => string;
}) {
  return (
    <>
      <StudioHeading
        title={t("هيكل الدورة", "Course Structure")}
        description={t(
          "ابدأ بالبيانات الأساسية التي يقبلها الخادم حالياً.",
          "Start with the core course data supported by the current server.",
        )}
      />
      <section className="studio-panel studio-form">
        <Field label={t("العنوان الفرعي", "Subtitle")}>
          <input
            value={draft.subtitle}
            onChange={(event) => update("subtitle", event.target.value)}
            disabled={readonly}
            maxLength={240}
          />
        </Field>
        <Field
          label={t("عنوان الدورة", "Course title")}
          error={errors.title}
          errorId="studio-structure-title-error"
        >
          <input
            id="studio-structure-title"
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
            disabled={readonly}
            maxLength={200}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={
              errors.title ? "studio-structure-title-error" : undefined
            }
          />
        </Field>
        <Field
          label={t("وصف الدورة", "Course description")}
          error={errors.description}
          errorId="studio-structure-description-error"
        >
          <textarea
            id="studio-structure-description"
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
            disabled={readonly}
            maxLength={2000}
            rows={6}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={
              errors.description
                ? "studio-structure-description-error"
                : undefined
            }
          />
        </Field>
        <Field label={t("نوع الدورة", "Course format")}>
          <select
            value={draft.courseType}
            onChange={(event) =>
              update(
                "courseType",
                event.target.value as CourseDraft["courseType"],
              )
            }
            disabled={readonly}
          >
            <option value="recorded">
              {t("دورة مسجلة", "Recorded course")}
            </option>
            <option value="live">{t("دورة مباشرة", "Live cohort")}</option>
          </select>
        </Field>
      </section>
    </>
  );
}

function CurriculumStep({
  lessons,
  loading,
  hasCourse,
  t,
}: {
  lessons: CourseLesson[];
  loading: boolean;
  hasCourse: boolean;
  t: (ar: string, en: string) => string;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("10");
  const [videoUrl, setVideoUrl] = useState("");
  const addLesson = useMutation({
    mutationFn: async () => {
      const id =
        typeof window !== "undefined"
          ? window.location.pathname.match(/courses\/([^/]+)/)?.[1]
          : undefined;
      if (!id) throw new Error("Course id is required.");
      return (
        await apiClient.post<CourseLesson>(`/courses/${id}/lessons`, {
          title: title.trim(),
          durationMinutes: Number(duration),
          contentType: "video",
          videoAssetId: videoUrl.trim() || undefined,
        })
      ).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["course-lessons"] });
      setTitle("");
      setVideoUrl("");
    },
  });
  return (
    <>
      <StudioHeading
        title={t("منشئ المنهج", "Curriculum Builder")}
        description={t(
          "راجع الدروس المسجلة للدورة بالترتيب الذي يعيده الخادم.",
          "Inspect server-backed lessons in their authoritative order.",
        )}
      />
      <section className="studio-panel">
        <div className="studio-panel__title">
          <div>
            <h2>{t("محتوى الدورة", "Course content")}</h2>
            <p>
              {hasCourse
                ? t(
                    "إضافة الدروس ورفع الملفات تحتاج إلى واجهات إنشاء وتحديث من الخادم.",
                    "Adding lessons and uploading files require server create/update endpoints.",
                  )
                : t(
                    "أنشئ الدورة أولاً حتى يصدر الخادم معرّفاً آمناً لها.",
                    "Create the course first so the server can issue its secure identifier.",
                  )}
            </p>
          </div>
          <span className="studio-capability">
            {t("رفع الوسائط متاح", "Media uploads ready")}
          </span>
        </div>
        {loading ? (
          <div className="skeleton course-studio__lesson-skeleton" />
        ) : lessons.length > 0 ? (
          <ol className="studio-lessons">
            {lessons.map((lesson) => (
              <li key={lesson.id}>
                <span>{String(lesson.lessonOrder).padStart(2, "0")}</span>
                <strong>{lesson.title}</strong>
                <small>
                  {lesson.durationMinutes} {t("دقيقة", "min")}
                </small>
              </li>
            ))}
          </ol>
        ) : (
          <div className="studio-inline-empty">
            {t(
              "لا توجد دروس مؤكدة من الخادم.",
              "No server-confirmed lessons are available.",
            )}
          </div>
        )}
        <div className="studio-disabled-row">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("عنوان الدرس", "Lesson title")}
          />
          <input
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            type="number"
            min="1"
            placeholder={t("الدقائق", "Minutes")}
          />
          <input
            value={videoUrl}
            onChange={(event) => setVideoUrl(event.target.value)}
            dir="ltr"
            placeholder="https://video-url"
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={!hasCourse || !title.trim() || addLesson.isPending}
            onClick={() => addLesson.mutate()}
          >
            ＋ {t("إضافة قسم أو درس", "Add section or lesson")}
          </button>
        </div>
      </section>
    </>
  );
}

function LandingStep({
  draft,
  update,
  errors,
  readonly,
  courseId,
  t,
}: {
  draft: CourseDraft;
  update: <K extends keyof CourseDraft>(key: K, value: CourseDraft[K]) => void;
  errors: Partial<Record<keyof CourseDraft, string>>;
  readonly: boolean;
  courseId?: string;
  t: (ar: string, en: string) => string;
}) {
  const queryClient = useQueryClient();
  const uploadMedia = useMutation({
    mutationFn: async ({
      kind,
      file,
    }: {
      kind: "cover" | "preview";
      file: File;
    }) => {
      if (!courseId) throw new Error("Create a draft first.");
      const body = new FormData();
      body.append("media", file);
      return (
        await apiClient.post<Course>(
          `/courses/${courseId}/media/${kind}`,
          body,
          { headers: { "Content-Type": "multipart/form-data" } },
        )
      ).data;
    },
    onSuccess: (course) => {
      if (course.thumbnailUrl) update("thumbnailUrl", course.thumbnailUrl);
    },
  });
  return (
    <>
      <StudioHeading
        title={t("صفحة عرض الدورة", "Course Landing Page")}
        description={t(
          "اضبط العنوان والوصف ورابط صورة الغلاف.",
          "Configure the course title, description, and cover image URL.",
        )}
      />
      <section className="studio-panel studio-form">
        <Field label={t("رفع غلاف الدورة", "Upload course cover")}>
          <input
            type="file"
            accept="image/*"
            disabled={!courseId || readonly || uploadMedia.isPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadMedia.mutate({ kind: "cover", file });
            }}
          />
        </Field>
        {courseId ? (
          <VideoUploader
            title={t("فيديو نظرة عامة على الدورة", "Course overview video")}
            description={t(
              "اشرح ما سيكتسبه الطلاب ولماذا صُممت هذه الدورة لهم.",
              "Explain what students will gain and why this course was designed for them.",
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
            onChange={() =>
              queryClient.invalidateQueries({ queryKey: ["my-courses"] })
            }
            testId="course-video-uploader"
          />
        ) : (
          <div className="studio-notice">
            <strong>
              {t(
                "أنشئ مسودة أولاً لرفع الفيديو",
                "Create a draft before uploading video",
              )}
            </strong>
            <p>
              {t(
                "بعد إنشاء المسودة ستتمكن من رفع فيديو آمن وإضافة الترجمة.",
                "Once the draft exists, you can upload a secure video and add captions.",
              )}
            </p>
          </div>
        )}
        <Field
          label={t("عنوان الدورة", "Course title")}
          error={errors.title}
          errorId="studio-landing-title-error"
        >
          <input
            id="studio-landing-title"
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
            disabled={readonly}
            maxLength={200}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={
              errors.title ? "studio-landing-title-error" : undefined
            }
          />
        </Field>
        <Field
          label={t("الوصف المختصر", "Course summary")}
          error={errors.description}
          errorId="studio-landing-description-error"
        >
          <textarea
            id="studio-landing-description"
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
            disabled={readonly}
            maxLength={2000}
            rows={5}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={
              errors.description
                ? "studio-landing-description-error"
                : undefined
            }
          />
        </Field>
        <Field
          label={t("رابط صورة الغلاف", "Course cover image URL")}
          error={errors.thumbnailUrl}
          errorId="studio-landing-thumbnailUrl-error"
        >
          <input
            id="studio-landing-thumbnailUrl"
            dir="ltr"
            type="url"
            value={draft.thumbnailUrl}
            onChange={(event) => update("thumbnailUrl", event.target.value)}
            disabled={readonly}
            placeholder="https://"
            aria-invalid={Boolean(errors.thumbnailUrl)}
            aria-describedby={
              errors.thumbnailUrl
                ? "studio-landing-thumbnailUrl-error"
                : undefined
            }
          />
        </Field>
        <div className="studio-cover-preview">
          {draft.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={draft.thumbnailUrl}
              alt={t("معاينة غلاف الدورة", "Course cover preview")}
            />
          ) : (
            <div className="course-card__placeholder">
              <span>MRH</span>
              <i />
            </div>
          )}
          <p>{t("معاينة الغلاف", "Cover preview")}</p>
        </div>
      </section>
    </>
  );
}

function PricingStep({
  draft,
  update,
  error,
  readonly,
  t,
}: {
  draft: CourseDraft;
  update: <K extends keyof CourseDraft>(key: K, value: CourseDraft[K]) => void;
  error?: string;
  readonly: boolean;
  t: (ar: string, en: string) => string;
}) {
  const validTitle = draft.title.trim().length >= 3;
  const validDescription = draft.description.trim().length >= 20;
  const validPrice =
    Number.isFinite(Number(draft.price)) && Number(draft.price) >= 0;
  return (
    <>
      <StudioHeading
        title={t("السعر ومراجعة الامتثال", "Pricing & Compliance Review")}
        description={t(
          "حدّد سعر الدورة وراجع جاهزية الحقول المدعومة قبل الإرسال.",
          "Set the course price and review supported-field readiness before submission.",
        )}
      />
      <section className="studio-panel studio-form studio-pricing">
        <Field
          label={t("سعر الدورة بالدولار", "Course price (USD)")}
          error={error}
          errorId="studio-pricing-price-error"
        >
          <input
            id="studio-pricing-price"
            dir="ltr"
            type="number"
            min="0"
            step="0.01"
            value={draft.price}
            onChange={(event) => update("price", event.target.value)}
            disabled={readonly}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "studio-pricing-price-error" : undefined}
          />
        </Field>
      </section>
      <section className="studio-panel">
        <div className="studio-panel__title">
          <div>
            <h2>
              {t("قائمة فحص ما قبل الإرسال", "Pre-flight quality checklist")}
            </h2>
            <p>
              {t(
                "تعكس الحقول التي سيتحقق منها الخادم عند الإنشاء.",
                "Reflects the fields validated when the server creates the course.",
              )}
            </p>
          </div>
        </div>
        <ul className="studio-checklist">
          <li data-complete={validTitle}>
            ✓ {t("عنوان صالح", "Valid course title")}
          </li>
          <li data-complete={validDescription}>
            ✓ {t("وصف واضح", "Clear course description")}
          </li>
          <li data-complete={validPrice}>
            ✓ {t("سعر مضبوط", "Price configured")}
          </li>
          <li data-complete={false}>
            ○{" "}
            {t(
              "المنهج وملفات الفيديو: دعم الخادم مطلوب",
              "Curriculum and preview media are validated by the server",
            )}
          </li>
        </ul>
      </section>
    </>
  );
}

function PromotionsStep({
  course,
  lang,
  t,
}: {
  course?: Course;
  lang: string;
  t: (ar: string, en: string) => string;
}) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const link = course
    ? `${origin}/${lang}/courses/${course.id}?ref=${encodeURIComponent(course.referralCode)}`
    : "";
  return (
    <>
      <StudioHeading
        title={t("العروض وروابط الإحالة", "Promotions & Referral Links")}
        description={t(
          "شارك رابط البيع الموقّع الذي أصدره الخادم لهذه الدورة.",
          "Share the signed selling link issued by the server for this course.",
        )}
      />
      <section className="studio-panel studio-referral">
        <div className="studio-panel__title">
          <div>
            <h2>{t("رابط إحالة الطالب", "Student referral link")}</h2>
            <p>
              {course
                ? t(
                    "هذا الرمز صادر من الخادم ومربوط بهذه الدورة.",
                    "This code is server-issued and bound to this course.",
                  )
                : t(
                    "يصدر الرابط بعد إنشاء الدورة بنجاح.",
                    "The link is issued after successful course creation.",
                  )}
            </p>
          </div>
          <span className="studio-capability">
            {course
              ? t("مؤكد", "Server confirmed")
              : t("غير متاح بعد", "Not available yet")}
          </span>
        </div>
        <input
          readOnly
          dir="ltr"
          value={link}
          placeholder={t("أنشئ الدورة أولاً", "Create the course first")}
        />
        <button
          type="button"
          className="btn-primary"
          disabled={!course}
          onClick={() => course && navigator.clipboard.writeText(link)}
        >
          {t("نسخ رابط الإحالة", "Copy referral link")}
        </button>
      </section>
      <section className="studio-panel">
        <div className="studio-panel__title">
          <div>
            <h2>{t("رموز الخصم", "Promotional coupons")}</h2>
            <p>
              {t(
                "لا توجد واجهة خادم لإنشاء رموز الخصم أو إدارتها حالياً.",
                "The current API has no coupon creation or management endpoint.",
              )}
            </p>
          </div>
          <span className="studio-capability">
            {t("دعم الخادم مطلوب", "Backend support required")}
          </span>
        </div>
        <button type="button" className="btn-secondary" disabled>
          ＋ {t("إنشاء رمز خصم", "Create coupon")}
        </button>
      </section>
    </>
  );
}

function Field({
  label,
  error,
  errorId,
  children,
}: {
  label: string;
  error?: string;
  errorId?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="studio-field">
      <span>{label}</span>
      {children}
      {error && (
        <small id={errorId} role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
