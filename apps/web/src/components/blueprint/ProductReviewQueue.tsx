"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";

type ProductStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "rejected"
  | "archived";

type ReviewItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string;
  thumbnailUrl?: string | null;
  courseType: "recorded" | "live";
  tutorId?: string;
  tutorName?: string;
  tutor?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    tutorProfile?: {
      bio?: string;
      specialization?: string;
      languages?: string[];
    };
  };
  submittedAt?: string | null;
  price: number;
  language?: string;
  category?: string | null;
  level?: string;
  status: ProductStatus;
  capacity?: number | null;
  timezone?: string;
  cohortStartAt?: string | null;
  cohortEndAt?: string | null;
  learningOutcomes?: string[] | null;
  requirements?: string[] | null;
  targetAudience?: string[] | null;
  overviewPlayback?: {
    status: string;
    embedUrl?: string;
  } | null;
};

type ReviewDetail = ReviewItem & {
  course?: ReviewItem;
  sections?: Array<{
    id: string;
    title: string;
    description?: string | null;
    lessons?: ReviewLesson[];
  }>;
  lessons?: ReviewLesson[];
};

type ReviewLesson = {
  id: string;
  sectionId?: string | null;
  title: string;
  description?: string | null;
  contentType?: "video" | "article" | "resource";
  durationMinutes?: number;
  isPreview?: boolean;
  videoUrl?: string | null;
  articleContent?: string | null;
  resourceUrl?: string | null;
  downloadableFiles?: Array<{ id: string; name: string; url?: string }>;
  externalLinks?: Array<{ title: string; url: string }>;
};

function collection<T>(value: T[] | { items?: T[] } | undefined) {
  return Array.isArray(value) ? value : value?.items ?? [];
}

function apiError(error: unknown, fallback: string) {
  const message = (
    error as { response?: { data?: { message?: string | string[] } } }
  )?.response?.data?.message;
  return Array.isArray(message)
    ? message.join(" ")
    : typeof message === "string"
      ? message
      : fallback;
}

function product(item: ReviewDetail | undefined) {
  return item?.course ?? item;
}

export function ProductReviewQueue({
  enabled,
  onCountChange,
}: {
  enabled: boolean;
  onCountChange?: (count: number) => void;
}) {
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const queryClient = useQueryClient();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [note, setNote] = useState("");

  const queueQuery = useQuery({
    queryKey: ["ops-product-review-queue"],
    queryFn: async () =>
      (
        await apiClient.get<ReviewItem[] | { items: ReviewItem[] }>(
          "/admin/courses",
          { params: { status: "pending_review" } },
        )
      ).data,
    enabled,
  });
  const queue = collection(queueQuery.data).filter(
    (item) => item.status === "pending_review",
  );

  useEffect(() => {
    onCountChange?.(queue.length);
  }, [onCountChange, queue.length]);

  const detailQuery = useQuery({
    queryKey: ["ops-product-review-detail", selectedId],
    queryFn: async () =>
      (
        await apiClient.get<ReviewDetail>(
          `/admin/courses/${selectedId}/review`,
        )
      ).data,
    enabled: Boolean(selectedId),
  });

  useEffect(() => {
    if (!selectedId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [selectedId]);

  const decide = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("No submission selected");
      if (decision === "reject") {
        const reason = note.trim();
        if (!reason) throw new Error(t("سبب الرفض مطلوب.", "A rejection reason is required."));
        return apiClient.post(`/admin/courses/${selectedId}/reject`, { reason });
      }
      return apiClient.post(`/admin/courses/${selectedId}/approve`, {
        note: note.trim() || undefined,
        videoQualityApproved: true,
      });
    },
    onSuccess: async () => {
      setSelectedId(null);
      setNote("");
      setDecision("approve");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["ops-product-review-queue"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["ops-product-review-detail"],
        }),
        queryClient.invalidateQueries({ queryKey: ["admin-courses"] }),
      ]);
    },
  });

  if (!enabled) return null;

  const detail = product(detailQuery.data);
  const sections = detailQuery.data?.sections ?? [];
  const lessons =
    detailQuery.data?.lessons ??
    sections.flatMap((section) => section.lessons ?? []);
  const tutorName =
    detail?.tutorName ||
    [detail?.tutor?.firstName, detail?.tutor?.lastName]
      .filter(Boolean)
      .join(" ") ||
    t("معلّم غير معروف", "Unknown tutor");

  return (
    <section
      className="ops-review"
      aria-labelledby="product-review-queue-title"
      data-testid="product-review-queue"
    >
      <header className="ops-review__head">
        <div>
          <p className="blueprint-kicker">
            {t("مكتب النشر الأكاديمي", "Academy publishing desk")}
          </p>
          <h2 id="product-review-queue-title">
            {t("مراجعة المنتجات التعليمية", "Learning product reviews")}
          </h2>
          <p>
            {t(
              "راجع كل دورة مسجلة أو عرض مباشر قبل ظهوره للطلاب.",
              "Inspect every recorded course or live offering before it reaches students.",
            )}
          </p>
        </div>
        <span className="ops-review__count" aria-label={t("عدد الطلبات", "Submission count")}>
          <strong>{queue.length}</strong>
          {t("بانتظار القرار", "awaiting decision")}
        </span>
      </header>

      {queueQuery.isLoading ? (
        <div className="ops-review__loading skeleton" aria-label={t("جاري تحميل المراجعات", "Loading reviews")} />
      ) : queueQuery.isError ? (
        <div className="ops-review__state" role="alert">
          <strong>{t("تعذّر تحميل قائمة المراجعة", "The review queue could not be loaded")}</strong>
          <button className="btn-secondary" type="button" onClick={() => queueQuery.refetch()}>
            {t("إعادة المحاولة", "Try again")}
          </button>
        </div>
      ) : queue.length === 0 ? (
        <div className="ops-review__state">
          <span aria-hidden="true">✓</span>
          <strong>{t("لا توجد منتجات معلّقة", "The publishing queue is clear")}</strong>
          <p>{t("ستظهر الطلبات الجديدة هنا فور إرسالها.", "New submissions will appear here as soon as tutors send them.")}</p>
        </div>
      ) : (
        <div className="ops-review__table-wrap">
          <table className="ops-review__table">
            <thead>
              <tr>
                <th>{t("المنتج", "Product")}</th>
                <th>{t("المعلّم", "Tutor")}</th>
                <th>{t("النوع", "Type")}</th>
                <th>{t("التقديم", "Submitted")}</th>
                <th>{t("السعر", "Price")}</th>
                <th>{t("اللغة والتصنيف", "Language / category")}</th>
                <th>{t("الحالة", "Status")}</th>
                <th><span className="sr-only">{t("الإجراء", "Action")}</span></th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.title}</strong>
                    {item.subtitle && <small>{item.subtitle}</small>}
                  </td>
                  <td>{item.tutorName || [item.tutor?.firstName, item.tutor?.lastName].filter(Boolean).join(" ") || "—"}</td>
                  <td>
                    <span className="ops-review__type" data-type={item.courseType}>
                      {item.courseType === "live"
                        ? t("عرض مباشر", "Live offering")
                        : t("دورة مسجلة", "Recorded course")}
                    </span>
                  </td>
                  <td>
                    {item.submittedAt
                      ? new Date(item.submittedAt).toLocaleDateString(
                          lang === "ar" ? "ar-EG" : "en-US",
                        )
                      : "—"}
                  </td>
                  <td dir="ltr">${Number(item.price || 0).toFixed(2)}</td>
                  <td>{[item.language, item.category].filter(Boolean).join(" · ") || "—"}</td>
                  <td>
                    <span className="ops-review__status">
                      {t("قيد المراجعة", "Pending review")}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setSelectedId(item.id);
                        setDecision("approve");
                        setNote("");
                      }}
                    >
                      {t("فتح المراجعة", "Open review")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && (
        <div
          className="ops-review-drawer"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !decide.isPending)
              setSelectedId(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-detail-title"
            className="ops-review-drawer__panel"
          >
            <header className="ops-review-drawer__bar">
              <div>
                <span>{t("مراجعة قبل النشر", "Pre-publication review")}</span>
                <h2 id="review-detail-title">
                  {detail?.title || t("تفاصيل الطلب", "Submission details")}
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="btn-ghost"
                onClick={() => setSelectedId(null)}
                disabled={decide.isPending}
                aria-label={t("إغلاق المراجعة", "Close review")}
              >
                ×
              </button>
            </header>

            {detailQuery.isLoading ? (
              <div className="ops-review-drawer__loading skeleton" />
            ) : detailQuery.isError || !detail ? (
              <div className="ops-review__state" role="alert">
                <strong>{t("تعذّر فتح تفاصيل الطلب", "Submission details could not be opened")}</strong>
                <button className="btn-secondary" type="button" onClick={() => detailQuery.refetch()}>
                  {t("إعادة المحاولة", "Try again")}
                </button>
              </div>
            ) : (
              <>
                <div className="ops-review-drawer__content">
                  <section className="ops-review-drawer__hero">
                    <div className="ops-review-drawer__cover">
                      {detail.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={detail.thumbnailUrl} alt="" />
                      ) : (
                        <span>MRH Academy</span>
                      )}
                    </div>
                    <div>
                      <span className="ops-review__type" data-type={detail.courseType}>
                        {detail.courseType === "live"
                          ? t("عرض مباشر", "Live offering")
                          : t("دورة مسجلة", "Recorded course")}
                      </span>
                      <h3>{detail.title}</h3>
                      {detail.subtitle && <p>{detail.subtitle}</p>}
                      <dl className="ops-review-drawer__facts">
                        <div><dt>{t("المعلّم", "Tutor")}</dt><dd>{tutorName}</dd></div>
                        <div><dt>{t("السعر", "Price")}</dt><dd dir="ltr">${Number(detail.price || 0).toFixed(2)}</dd></div>
                        <div><dt>{t("اللغة", "Language")}</dt><dd>{detail.language || "—"}</dd></div>
                        <div><dt>{t("التصنيف", "Category")}</dt><dd>{detail.category || "—"}</dd></div>
                      </dl>
                    </div>
                  </section>

                  <ReviewSection title={t("الوصف", "Description")}>
                    <p>{detail.description || t("لا يوجد وصف.", "No description provided.")}</p>
                  </ReviewSection>

                  {detail.courseType === "live" && (
                    <ReviewSection title={t("تفاصيل العرض المباشر", "Live offering details")}>
                      <dl className="ops-review-drawer__facts">
                        <div><dt>{t("البداية", "Starts")}</dt><dd>{detail.cohortStartAt ? new Date(detail.cohortStartAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US") : "—"}</dd></div>
                        <div><dt>{t("النهاية", "Ends")}</dt><dd>{detail.cohortEndAt ? new Date(detail.cohortEndAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US") : "—"}</dd></div>
                        <div><dt>{t("السعة", "Capacity")}</dt><dd>{detail.capacity ?? "—"}</dd></div>
                        <div><dt>{t("المنطقة الزمنية", "Timezone")}</dt><dd>{detail.timezone || "—"}</dd></div>
                      </dl>
                    </ReviewSection>
                  )}

                  {detail.overviewPlayback?.embedUrl && (
                    <ReviewSection title={t("الفيديو التعريفي", "Promo / preview video")}>
                      <iframe
                        className="ops-review-drawer__video"
                        src={detail.overviewPlayback.embedUrl}
                        title={t("معاينة الفيديو التعريفي", "Promo video preview")}
                        allow="accelerometer; encrypted-media; picture-in-picture"
                        allowFullScreen
                      />
                    </ReviewSection>
                  )}

                  <ReviewSection title={t("الجمهور ونتائج التعلّم", "Audience and learning outcomes")}>
                    <ReviewLists
                      items={[
                        [t("نتائج التعلّم", "Outcomes"), detail.learningOutcomes],
                        [t("المتطلبات", "Requirements"), detail.requirements],
                        [t("الجمهور المستهدف", "Target audience"), detail.targetAudience],
                      ]}
                    />
                  </ReviewSection>

                  <ReviewSection title={t("المنهج والمواد", "Curriculum and materials")}>
                    {sections.length === 0 && lessons.length === 0 ? (
                      <p>{t("لا توجد وحدات مرفقة.", "No curriculum items were submitted.")}</p>
                    ) : (
                      <div className="ops-review-drawer__curriculum">
                        {(sections.length
                          ? sections
                          : [{ id: "all", title: t("المحتوى", "Content"), lessons }]
                        ).map((section) => {
                          const sectionLessons =
                            section.lessons ??
                            lessons.filter((lesson) => lesson.sectionId === section.id);
                          return (
                            <article key={section.id}>
                              <header>
                                <strong>{section.title}</strong>
                                <span>{sectionLessons.length} {t("دروس", "lessons")}</span>
                              </header>
                              {sectionLessons.map((lesson) => (
                                <div key={lesson.id}>
                                  <span>{lesson.contentType || "video"}</span>
                                  <strong>{lesson.title}</strong>
                                  <small>
                                    {lesson.durationMinutes ?? 0} {t("دقيقة", "min")}
                                    {(lesson.downloadableFiles?.length ?? 0) > 0 &&
                                      ` · ${lesson.downloadableFiles!.length} ${t("ملفات", "files")}`}
                                    {(lesson.externalLinks?.length ?? 0) > 0 &&
                                      ` · ${lesson.externalLinks!.length} ${t("روابط", "links")}`}
                                  </small>
                                  {((lesson.downloadableFiles?.length ?? 0) > 0 ||
                                    (lesson.externalLinks?.length ?? 0) > 0) && (
                                    <ul className="ops-review-drawer__materials">
                                      {lesson.downloadableFiles?.map((file) => (
                                        <li key={file.id}>
                                          {file.url ? (
                                            <a
                                              href={file.url}
                                              target="_blank"
                                              rel="noreferrer"
                                            >
                                              {file.name}
                                            </a>
                                          ) : (
                                            file.name
                                          )}
                                        </li>
                                      ))}
                                      {lesson.externalLinks?.map((link) => (
                                        <li key={link.url}>
                                          <a
                                            href={link.url}
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            {link.title || link.url}
                                          </a>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              ))}
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </ReviewSection>

                  <ReviewSection title={t("ملف المعلّم", "Tutor profile")}>
                    <h4>{tutorName}</h4>
                    <p>{detail.tutor?.tutorProfile?.bio || t("لا توجد نبذة مرفقة.", "No tutor bio provided.")}</p>
                    <small>
                      {[detail.tutor?.tutorProfile?.specialization, ...(detail.tutor?.tutorProfile?.languages ?? [])]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </ReviewSection>
                </div>

                <footer className="ops-review-drawer__decision">
                  <div className="ops-review-drawer__decision-tabs" role="group" aria-label={t("قرار المراجعة", "Review decision")}>
                    <button type="button" aria-pressed={decision === "approve"} onClick={() => setDecision("approve")}>
                      {t("اعتماد", "Approve")}
                    </button>
                    <button type="button" aria-pressed={decision === "reject"} onClick={() => setDecision("reject")}>
                      {t("رفض مع ملاحظات", "Reject with feedback")}
                    </button>
                  </div>
                  <label>
                    <span>
                      {decision === "reject"
                        ? t("سبب الرفض (مطلوب)", "Rejection reason (required)")
                        : t("ملاحظة للمعلّم (اختيارية)", "Note to tutor (optional)")}
                    </span>
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder={
                        decision === "reject"
                          ? t("اشرح التعديلات المطلوبة بوضوح…", "Explain the required changes clearly…")
                          : t("أضف ملاحظة تساعد المعلّم…", "Add a helpful note for the tutor…")
                      }
                    />
                  </label>
                  {decide.isError && (
                    <p className="blueprint-error" role="alert">
                      {apiError(decide.error, t("تعذّر حفظ القرار.", "The decision could not be saved."))}
                    </p>
                  )}
                  <button
                    type="button"
                    className={decision === "approve" ? "btn-primary" : "btn-secondary"}
                    disabled={decide.isPending || (decision === "reject" && !note.trim())}
                    onClick={() => decide.mutate()}
                    data-testid={`review-${decision}`}
                  >
                    {decide.isPending
                      ? t("جاري حفظ القرار…", "Saving decision…")
                      : decision === "approve"
                        ? t("اعتماد ونشر للطلاب", "Approve and publish")
                        : t("إرسال طلب التعديلات", "Send revision request")}
                  </button>
                </footer>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ops-review-drawer__section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function ReviewLists({
  items,
}: {
  items: Array<[string, string[] | null | undefined]>;
}) {
  return (
    <div className="ops-review-drawer__lists">
      {items.map(([title, values]) => (
        <div key={title}>
          <strong>{title}</strong>
          {values?.length ? (
            <ul>
              {values.map((value) => <li key={value}>{value}</li>)}
            </ul>
          ) : (
            <p>—</p>
          )}
        </div>
      ))}
    </div>
  );
}
