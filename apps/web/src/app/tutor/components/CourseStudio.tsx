'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

type Course = {
  id: string;
  title: string;
  price: number;
  status?: string;
  referralCode: string;
};

type CourseDraft = { title: string; description: string; price: string; thumbnailUrl: string };
const EMPTY_DRAFT: CourseDraft = { title: '', description: '', price: '', thumbnailUrl: '' };

export default function CourseStudio() {
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => lang === 'ar' ? ar : en;
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<CourseDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Partial<Record<keyof CourseDraft, string>>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const coursesQuery = useQuery({
    queryKey: ['my-courses'],
    queryFn: async () => (await apiClient.get<Course[]>('/courses/my/courses')).data,
  });

  const referralStatsQuery = useQuery({
    queryKey: ['tutor-referral-stats'],
    queryFn: async () => (await apiClient.get<{
      tutor: { sales: number }; academy: { sales: number };
    }>('/courses/my/referral-stats')).data,
  });

  const createCourse = useMutation({
    mutationFn: async () => (await apiClient.post<Course>('/courses', {
      title: draft.title.trim(),
      description: draft.description.trim(),
      price: Number(draft.price),
      ...(draft.thumbnailUrl.trim() ? { thumbnailUrl: draft.thumbnailUrl.trim() } : {}),
    })).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-courses'] }),
        queryClient.invalidateQueries({ queryKey: ['tutor-referral-stats'] }),
      ]);
      setDraft(EMPTY_DRAFT);
      setErrors({});
      setIsOpen(false);
    },
  });

  const courses = coursesQuery.data ?? [];
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const approvalNote = t(
    'تحتاج الدورات الجديدة إلى موافقة الأكاديمية قبل أن يتمكن الطلاب من شرائها.',
    'New courses require academy approval before students can purchase them.',
  );

  const statusLabel = {
    pending: t('قيد المراجعة', 'Pending review'),
    approved: t('معتمدة', 'Approved'),
    rejected: t('مرفوضة', 'Rejected'),
    draft: t('مسودة', 'Draft'),
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (draft.title.trim().length < 3) nextErrors.title = t('أدخل عنواناً من 3 أحرف على الأقل.', 'Enter a title of at least 3 characters.');
    if (draft.description.trim().length < 20) nextErrors.description = t('أدخل وصفاً واضحاً من 20 حرفاً على الأقل.', 'Enter a clear description of at least 20 characters.');
    if (!Number.isFinite(Number(draft.price)) || Number(draft.price) <= 0) nextErrors.price = t('أدخل سعراً صحيحاً أكبر من صفر.', 'Enter a valid price greater than zero.');
    if (draft.thumbnailUrl && !/^https?:\/\//i.test(draft.thumbnailUrl)) nextErrors.thumbnailUrl = t('أدخل رابط صورة صحيحاً.', 'Enter a valid image URL.');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) createCourse.mutate();
  }

  function courseLink(course: Course) {
    return `${origin}/courses/${course.id}?ref=${encodeURIComponent(course.referralCode)}`;
  }

  async function copy(course: Course) {
    await navigator.clipboard.writeText(courseLink(course));
    setCopiedId(course.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  }

  return (
    <section className="card-dark overflow-hidden" aria-labelledby="course-studio-title">
      <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6" style={{ borderColor: 'var(--border-color)' }}>
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--primary-color)' }}>{t('استوديو الدورات', 'Course studio')}</p>
          <h3 id="course-studio-title" className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>{t('إدارة دوراتك وروابط البيع', 'Manage courses and selling links')}</h3>
          <p className="mt-1 max-w-2xl text-sm" style={{ color: 'var(--text-muted)' }}>{approvalNote}</p>
        </div>
        <button type="button" onClick={() => setIsOpen(true)} className="btn-outline-gold min-h-11 shrink-0 px-5">
          <span aria-hidden="true" className="text-lg leading-none">+</span>
          {t('إنشاء دورة', 'Create Course')}
        </button>
      </div>

      <div className="grid gap-3 border-b p-5 sm:grid-cols-2 sm:p-6" style={{ borderColor: 'var(--border-color)', background: 'color-mix(in srgb, var(--primary-color) 4%, transparent)' }}>
        <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-main)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('مبيعات رابطك — حصتك', 'Your referral sales — your share')}</span>
          <div className="mt-1 flex items-end justify-between"><strong className="text-xl" style={{ color: 'var(--text-main)' }}>{referralStatsQuery.data?.tutor.sales ?? 0}</strong><span className="text-sm font-bold" style={{ color: 'var(--primary-color)' }}>98%</span></div>
        </div>
        <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-main)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('مبيعات الأكاديمية — حصتك', 'Academy sales — your share')}</span>
          <div className="mt-1 flex items-end justify-between"><strong className="text-xl" style={{ color: 'var(--text-main)' }}>{referralStatsQuery.data?.academy.sales ?? 0}</strong><span className="text-sm font-bold" style={{ color: 'var(--primary-color)' }}>47%</span></div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {coursesQuery.isLoading ? (
          <div className="space-y-3" aria-label={t('جاري تحميل الدورات', 'Loading courses')}><div className="skeleton h-28 rounded-xl" /><div className="skeleton h-28 rounded-xl" /></div>
        ) : coursesQuery.isError ? (
          <div className="rounded-xl border p-5 text-center" style={{ borderColor: 'rgba(239,68,68,.35)' }}>
            <p className="text-sm text-red-500">{t('تعذر تحميل دوراتك.', 'Your courses could not be loaded.')}</p>
            <button type="button" onClick={() => coursesQuery.refetch()} className="btn-secondary mt-3">{t('إعادة المحاولة', 'Try again')}</button>
          </div>
        ) : courses.length === 0 ? (
          <div className="rounded-xl border border-dashed px-5 py-10 text-center" style={{ borderColor: 'var(--border-color)' }}>
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl text-xl" style={{ background: 'rgba(212,163,83,.12)', color: 'var(--primary-color)' }} aria-hidden="true">＋</div>
            <h4 className="font-bold" style={{ color: 'var(--text-main)' }}>{t('أنشئ أول دورة لك', 'Create your first course')}</h4>
            <p className="mx-auto mt-1 max-w-md text-sm" style={{ color: 'var(--text-muted)' }}>{t('سيتم إنشاء كود بيع ورابط موقّع خاص بالدورة فور إرسالها.', 'A unique signed selling code and link are created as soon as you submit it.')}</p>
            <button type="button" onClick={() => setIsOpen(true)} className="btn-primary mt-5">{t('إنشاء دورة', 'Create Course')}</button>
          </div>
        ) : (
          <div className="space-y-4">
            {courses.map((course) => {
              const status = course.status ?? 'pending';
              return (
                <article key={course.id} className="rounded-xl border p-4 sm:p-5" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-main)' }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h4 className="font-bold" style={{ color: 'var(--text-main)' }}>{course.title}</h4><p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>${course.price.toFixed(2)}</p></div>
                    <span className="rounded-md border px-2.5 py-1 text-xs font-semibold" style={{ color: status === 'approved' ? '#22c55e' : '#d9a441', borderColor: status === 'approved' ? 'rgba(34,197,94,.35)' : 'rgba(217,164,65,.35)', background: status === 'approved' ? 'rgba(34,197,94,.08)' : 'rgba(217,164,65,.08)' }}>{statusLabel[status as keyof typeof statusLabel] ?? status}</span>
                  </div>
                  <div className="mt-4 rounded-lg border p-3" style={{ borderColor: 'color-mix(in srgb, var(--primary-color) 30%, transparent)', background: 'color-mix(in srgb, var(--primary-color) 6%, transparent)' }}>
                    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold" style={{ color: 'var(--primary-color)' }}>{t('كود البيع', 'Selling code')}</span><span className="text-xs font-bold" style={{ color: 'var(--primary-color)' }}>98% {t('حصتك', 'your share')}</span></div>
                    <code className="mt-1 block break-all text-sm font-bold" dir="ltr" style={{ color: 'var(--text-main)' }}>{course.referralCode}</code>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"><input readOnly value={courseLink(course)} className="input-field min-w-0 flex-1 text-xs" dir="ltr" aria-label={t('رابط بيع الدورة', 'Course selling link')} /><button type="button" onClick={() => copy(course)} className="btn-secondary min-h-10 shrink-0 px-4">{copiedId === course.id ? t('تم النسخ', 'Copied') : t('نسخ الرابط', 'Copy Link')}</button></div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="create-course-title" className="card-dark max-h-[92vh] w-full max-w-xl overflow-y-auto p-6 shadow-2xl sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4"><div><h2 id="create-course-title" className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>{t('إنشاء دورة جديدة', 'Create a new course')}</h2><p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{approvalNote}</p></div><button type="button" onClick={() => setIsOpen(false)} className="btn-ghost min-h-10 min-w-10 text-xl" aria-label={t('إغلاق', 'Close')}>×</button></div>
            <form onSubmit={submit} className="space-y-5" noValidate>
              <CourseField label={t('عنوان الدورة', 'Course title')} error={errors.title}><input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="input-field" maxLength={120} /></CourseField>
              <CourseField label={t('الوصف', 'Description')} error={errors.description}><textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="input-field min-h-28 resize-y" maxLength={2000} /></CourseField>
              <div className="grid gap-5 sm:grid-cols-2"><CourseField label={t('السعر بالدولار', 'Price (USD)')} error={errors.price}><input value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} className="input-field" type="number" min="0.01" step="0.01" dir="ltr" /></CourseField><CourseField label={t('رابط الصورة المصغرة (اختياري)', 'Thumbnail URL (optional)')} error={errors.thumbnailUrl}><input value={draft.thumbnailUrl} onChange={(e) => setDraft({ ...draft, thumbnailUrl: e.target.value })} className="input-field" type="url" dir="ltr" placeholder="https://" /></CourseField></div>
              {createCourse.isError && <p className="rounded-xl border px-4 py-3 text-sm text-red-500" style={{ borderColor: 'rgba(239,68,68,.35)', background: 'rgba(239,68,68,.08)' }}>{t('تعذر إنشاء الدورة. راجع البيانات وحاول مجدداً.', 'Course creation failed. Review the details and try again.')}</p>}
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setIsOpen(false)} className="btn-secondary min-h-11">{t('إلغاء', 'Cancel')}</button><button type="submit" disabled={createCourse.isPending} className="btn-primary min-h-11">{createCourse.isPending ? t('جاري الإنشاء...', 'Creating...') : t('إنشاء الدورة وإصدار الرابط', 'Create course & issue link')}</button></div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function CourseField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{label}<span className="mt-1.5 block">{children}</span>{error && <span className="mt-1 block text-xs font-normal text-red-500">{error}</span>}</label>;
}
