"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";
import {
  BookIcon,
  CheckIcon,
  CloseIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
} from "@/components/icons/Icons";

type Course = {
  id: string;
  title: string;
  description: string;
  price: number;
  tutorName: string;
  isApproved: boolean;
  createdAt: string;
};

type Confirmation = { action: "approve" | "delete"; course: Course } | null;
const EMPTY_FORM = { title: "", description: "", price: 0, tutorId: "" };

export default function CoursesTab() {
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const confirmationDialogRef = useRef<HTMLDivElement>(null);
  const confirmationCancelRef = useRef<HTMLButtonElement>(null);
  const confirmationTriggerRef = useRef<HTMLButtonElement | null>(null);

  function openConfirmation(
    next: Exclude<Confirmation, null>,
    trigger: HTMLButtonElement,
  ) {
    confirmationTriggerRef.current = trigger;
    setConfirmation(next);
  }

  function closeConfirmation() {
    setConfirmation(null);
    window.requestAnimationFrame(() => {
      confirmationTriggerRef.current?.focus();
      confirmationTriggerRef.current = null;
    });
  }

  const tutorsQuery = useQuery({
    queryKey: ["admin-tutors-list"],
    queryFn: async () =>
      (
        await apiClient.get<
          Array<{
            userId: string;
            user?: { firstName: string; lastName: string };
          }>
        >("/admin/tutors")
      ).data,
  });
  const coursesQuery = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => (await apiClient.get<Course[]>("/admin/courses")).data,
  });

  const createMutation = useMutation({
    mutationFn: async () => (await apiClient.post("/admin/courses", form)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      setShowAdd(false);
      setForm(EMPTY_FORM);
    },
  });
  const approveMutation = useMutation({
    mutationFn: async (id: string) =>
      (
        await apiClient.post(`/admin/courses/${id}/approve`, {
          videoQualityApproved: true,
        })
      ).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      closeConfirmation();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/admin/courses/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      closeConfirmation();
    },
  });

  function submitCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.reset();
    createMutation.mutate();
  }

  const confirmationPending =
    approveMutation.isPending || deleteMutation.isPending;
  const confirmationError = approveMutation.isError || deleteMutation.isError;

  useEffect(() => {
    if (confirmation) confirmationCancelRef.current?.focus();
  }, [confirmation]);

  function handleConfirmationKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !confirmationPending) {
      event.preventDefault();
      closeConfirmation();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      confirmationDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="courses-title">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="courses-title"
            className="text-lg font-bold"
            style={{ color: "var(--text-main)" }}
          >
            {t("إدارة الدورات", "Course Management")}
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {coursesQuery.isLoading
              ? t("جاري تحميل الدورات...", "Loading courses...")
              : coursesQuery.isError
                ? t("عدد الدورات غير متاح", "Course count unavailable")
                : t(
                    `${coursesQuery.data?.length ?? 0} دورة مسجلة`,
                    `${coursesQuery.data?.length ?? 0} persisted courses`,
                  )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="btn-primary min-h-11 shrink-0"
        >
          <PlusIcon className="h-4 w-4" />
          {t("إضافة دورة", "Add Course")}
        </button>
      </header>

      <div className="card overflow-hidden">
        {coursesQuery.isLoading ? (
          <div
            className="space-y-3 p-5"
            aria-label={t("جاري تحميل الدورات", "Loading courses")}
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-14 rounded skeleton" />
            ))}
          </div>
        ) : coursesQuery.isError ? (
          <div className="p-6 text-center" role="alert">
            <p className="text-sm font-semibold text-red-500">
              {t(
                "تعذر تحميل الدورات من قاعدة البيانات.",
                "Courses could not be loaded from the database.",
              )}
            </p>
            <button
              type="button"
              onClick={() => coursesQuery.refetch()}
              className="btn-secondary mt-4 min-h-10"
            >
              <RefreshIcon className="h-4 w-4" />
              {t("إعادة المحاولة", "Try again")}
            </button>
          </div>
        ) : coursesQuery.data?.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <span
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: "rgba(212,163,83,.12)", color: "#D4A353" }}
            >
              <BookIcon />
            </span>
            <h3
              className="mt-4 font-bold"
              style={{ color: "var(--text-main)" }}
            >
              {t("لا توجد دورات مقدمة بعد", "No course has been submitted yet")}
            </h3>
            <p
              className="mx-auto mt-2 max-w-md text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              {t(
                "ستظهر هنا الدورات الحقيقية بمجرد إنشائها بواسطة الإدارة أو تقديمها من معلم.",
                "Persisted courses will appear here when an administrator creates one or a tutor submits one.",
              )}
            </p>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="btn-primary mt-5 min-h-11"
            >
              <PlusIcon className="h-4 w-4" />
              {t("إضافة أول دورة", "Add the first course")}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr style={{ background: "var(--bg-light)" }}>
                  {[
                    t("العنوان", "Title"),
                    t("المعلم", "Tutor"),
                    t("السعر", "Price"),
                    t("الحالة", "Status"),
                    t("الإجراءات", "Actions"),
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-start font-semibold"
                      style={{ color: "var(--text-main)" }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coursesQuery.data?.map((course) => (
                  <tr
                    key={course.id}
                    className="border-t"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <td
                      className="px-4 py-4 font-semibold"
                      style={{ color: "var(--text-main)" }}
                    >
                      {course.title}
                    </td>
                    <td
                      className="px-4 py-4"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {course.tutorName}
                    </td>
                    <td
                      className="px-4 py-4 font-semibold"
                      dir="ltr"
                      style={{ color: "#D4A353" }}
                    >
                      ${Number(course.price).toFixed(2)}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className="rounded-md border px-2.5 py-1 text-xs font-semibold"
                        style={
                          course.isApproved
                            ? {
                                background: "rgba(34,197,94,.08)",
                                color: "#16a34a",
                                borderColor: "rgba(34,197,94,.3)",
                              }
                            : {
                                background: "rgba(234,179,8,.08)",
                                color: "#ca8a04",
                                borderColor: "rgba(234,179,8,.3)",
                              }
                        }
                      >
                        {course.isApproved
                          ? t("معتمدة", "Approved")
                          : t("قيد المراجعة", "Pending review")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {!course.isApproved && (
                          <button
                            type="button"
                            onClick={(event) =>
                              openConfirmation(
                                { action: "approve", course },
                                event.currentTarget,
                              )
                            }
                            className="btn-ghost min-h-10 px-3 text-xs text-green-600"
                            aria-label={t(
                              `اعتماد ${course.title}`,
                              `Approve ${course.title}`,
                            )}
                          >
                            <CheckIcon className="h-4 w-4" />
                            {t("اعتماد", "Approve")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(event) =>
                            openConfirmation(
                              { action: "delete", course },
                              event.currentTarget,
                            )
                          }
                          className="btn-ghost min-h-10 px-3 text-xs text-red-500"
                          aria-label={t(
                            `حذف ${course.title}`,
                            `Delete ${course.title}`,
                          )}
                        >
                          <TrashIcon className="h-4 w-4" />
                          {t("حذف", "Delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !createMutation.isPending
            )
              setShowAdd(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-course-title"
            className="card w-full max-w-lg overflow-hidden shadow-2xl"
          >
            <header
              className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: "var(--border-color)" }}
            >
              <h3
                id="add-course-title"
                className="text-lg font-bold"
                style={{ color: "var(--text-main)" }}
              >
                {t("إضافة دورة جديدة", "Add New Course")}
              </h3>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                disabled={createMutation.isPending}
                className="btn-ghost min-h-10 min-w-10 p-2"
                aria-label={t("إغلاق", "Close")}
                title={t("إغلاق", "Close")}
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </header>
            <form onSubmit={submitCourse}>
              <div className="space-y-4 p-5">
                <label
                  className="block text-sm font-medium"
                  style={{ color: "var(--text-main)" }}
                >
                  {t("المعلم", "Tutor")}
                  <select
                    className="input-field mt-1.5"
                    value={form.tutorId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        tutorId: event.target.value,
                      }))
                    }
                    required
                    disabled={tutorsQuery.isLoading}
                  >
                    <option value="">
                      {t("اختر معلماً", "Select a tutor")}
                    </option>
                    {tutorsQuery.data?.map((tutor) => (
                      <option key={tutor.userId} value={tutor.userId}>
                        {tutor.user
                          ? `${tutor.user.firstName} ${tutor.user.lastName}`
                          : tutor.userId}
                      </option>
                    ))}
                  </select>
                </label>
                {tutorsQuery.isError && (
                  <p className="text-xs text-red-500">
                    {t(
                      "تعذر تحميل قائمة المعلمين.",
                      "The tutor list could not be loaded.",
                    )}
                  </p>
                )}
                <label
                  className="block text-sm font-medium"
                  style={{ color: "var(--text-main)" }}
                >
                  {t("عنوان الدورة", "Course Title")}
                  <input
                    className="input-field mt-1.5"
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label
                  className="block text-sm font-medium"
                  style={{ color: "var(--text-main)" }}
                >
                  {t("الوصف", "Description")}
                  <textarea
                    className="input-field mt-1.5 min-h-24 resize-y"
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
                <label
                  className="block text-sm font-medium"
                  style={{ color: "var(--text-main)" }}
                >
                  {t("السعر", "Price")}
                  <input
                    className="input-field mt-1.5"
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.price}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        price: Number(event.target.value) || 0,
                      }))
                    }
                  />
                </label>
                {createMutation.isError && (
                  <p role="alert" className="text-sm text-red-500">
                    {t(
                      "تعذر إنشاء الدورة. حاول مجدداً.",
                      "Course creation failed. Try again.",
                    )}
                  </p>
                )}
              </div>
              <footer
                className="flex flex-col-reverse gap-3 border-t px-5 py-4 sm:flex-row sm:justify-end"
                style={{ borderColor: "var(--border-color)" }}
              >
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="btn-secondary min-h-11"
                >
                  {t("إلغاء", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={
                    createMutation.isPending ||
                    !form.title.trim() ||
                    !form.tutorId
                  }
                  className="btn-primary min-h-11"
                >
                  {createMutation.isPending
                    ? t("جاري الإنشاء...", "Creating...")
                    : t("إنشاء الدورة", "Create Course")}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {confirmation && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          role="presentation"
        >
          <div
            ref={confirmationDialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-course-title"
            aria-describedby="confirm-course-description"
            className="card w-full max-w-md p-6 shadow-2xl"
            onKeyDown={handleConfirmationKeyDown}
          >
            <h3
              id="confirm-course-title"
              className="text-lg font-bold"
              style={{ color: "var(--text-main)" }}
            >
              {confirmation.action === "approve"
                ? t("اعتماد الدورة", "Approve course")
                : t("حذف الدورة", "Delete course")}
            </h3>
            <p
              id="confirm-course-description"
              className="mt-2 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              {confirmation.action === "approve"
                ? t(
                    `أؤكد أنني راجعت جودة جميع فيديوهات «${confirmation.course.title}» وأنها جاهزة للبيع.`,
                    `I confirm every video in “${confirmation.course.title}” has been reviewed and is ready for sale.`,
                  )
                : t(
                    `سيتم حذف «${confirmation.course.title}» نهائياً. لا يمكن التراجع عن هذا الإجراء.`,
                    `“${confirmation.course.title}” will be permanently deleted. This action cannot be undone.`,
                  )}
            </p>
            {confirmationError && (
              <p role="alert" className="mt-3 text-sm text-red-500">
                {t(
                  "تعذر تنفيذ الإجراء. حاول مجدداً.",
                  "The action failed. Try again.",
                )}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                ref={confirmationCancelRef}
                type="button"
                disabled={confirmationPending}
                onClick={closeConfirmation}
                className="btn-secondary min-h-11"
              >
                {t("إلغاء", "Cancel")}
              </button>
              <button
                type="button"
                disabled={confirmationPending}
                onClick={() =>
                  confirmation.action === "approve"
                    ? approveMutation.mutate(confirmation.course.id)
                    : deleteMutation.mutate(confirmation.course.id)
                }
                className={
                  confirmation.action === "delete"
                    ? "btn-secondary min-h-11 text-red-500"
                    : "btn-primary min-h-11"
                }
              >
                {confirmationPending
                  ? t("جاري التنفيذ...", "Working...")
                  : confirmation.action === "approve"
                    ? t("تأكيد الاعتماد", "Confirm approval")
                    : t("تأكيد الحذف", "Delete course")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
