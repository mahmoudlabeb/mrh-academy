'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

type Course = {
  id: string;
  title: string;
  description: string;
  price: number;
  tutorName: string;
  isApproved: boolean;
  createdAt: string;
  videoQualityApprovedAt?: string | null;
};

export default function CoursesTab() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', price: 0, tutorId: '' });

  const tutorsQuery = useQuery({
    queryKey: ['admin-tutors-list'],
    queryFn: async () => {
      const { data } = await apiClient.get<Array<{ userId: string; user?: { firstName: string; lastName: string } }>>('/admin/tutors');
      return data;
    },
  });

  const coursesQuery = useQuery({
    queryKey: ['admin-courses'],
    queryFn: async () => {
      const { data } = await apiClient.get<Course[]>('/admin/courses');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const { data } = await apiClient.post('/admin/courses', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      setShowAdd(false);
      setForm({ title: '', description: '', price: 0, tutorId: '' });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const confirmed = window.confirm(
        lang === 'ar'
          ? 'أؤكد أنني راجعت جودة جميع فيديوهات هذا الكورس وأصبحت صالحة للبيع.'
          : 'I confirm that I reviewed the quality of every course video and it is ready for sale.',
      );
      if (!confirmed) throw new Error('Video quality review was not confirmed');
      const { data } = await apiClient.post(`/admin/courses/${id}/approve`, {
        videoQualityApproved: true,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/courses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
    },
  });

  const handleDelete = (id: string) => {
    if (lang === 'ar' ? !confirm('هل أنت متأكد من حذف هذا الكورس؟') : !confirm('Delete this course?')) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {coursesQuery.data?.length ?? 0} {lang === 'ar' ? 'كورس' : 'courses'}
        </span>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          {lang === 'ar' ? 'إضافة كورس' : 'Add Course'}
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-light)' }}>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'العنوان' : 'Title'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'المدرس' : 'Tutor'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'السعر' : 'Price'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {coursesQuery.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-5 skeleton rounded w-3/4" /></td>
                    ))}
                  </tr>
                ))
              ) : coursesQuery.data?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                    {lang === 'ar' ? 'لا توجد كورسات' : 'No courses'}
                  </td>
                </tr>
              ) : (
                coursesQuery.data?.map((course) => (
                  <tr key={course.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-main)' }}>{course.title}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{course.tutorName}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: '#D4A353' }}>${course.price.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className="badge text-xs" style={course.isApproved ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' } : { background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' }}>
                        {course.isApproved ? (lang === 'ar' ? 'معتمد' : 'Approved') : (lang === 'ar' ? 'قيد الانتظار' : 'Pending')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-left">
                      {!course.isApproved && (
                        <button
                          onClick={() => approveMutation.mutate(course.id)}
                          disabled={approveMutation.isPending}
                          className="btn-ghost px-2 py-1 text-xs"
                          style={{ color: '#22c55e' }}
                        >
                          {lang === 'ar' ? 'اعتماد' : 'Approve'}
                        </button>
                      )}
                      <button onClick={() => handleDelete(course.id)} className="btn-ghost px-2 py-1 text-xs" style={{ color: '#ef4444' }}>{lang === 'ar' ? 'حذف' : 'Delete'}</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-lg rounded-2xl animate-scale-in" style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
            <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>
                {lang === 'ar' ? 'إضافة كورس جديد' : 'Add New Course'}
              </h3>
              <button onClick={() => setShowAdd(false)} className="btn-ghost px-2 py-1" style={{ color: 'var(--text-muted)' }}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'المعلم' : 'Tutor'}</label>
                <select
                  className="input-field"
                  value={form.tutorId}
                  onChange={(e) => setForm((f) => ({ ...f, tutorId: e.target.value }))}
                  required
                >
                  <option value="">{lang === 'ar' ? 'اختر معلمًا' : 'Select a tutor'}</option>
                  {tutorsQuery.data?.map((tutor) => (
                    <option key={tutor.userId} value={tutor.userId}>
                      {tutor.user ? `${tutor.user.firstName} ${tutor.user.lastName}` : tutor.userId}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'عنوان الكورس' : 'Course Title'}</label>
                <input className="input-field" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'الوصف' : 'Description'}</label>
                <textarea className="input-field resize-none" rows={3} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'السعر' : 'Price'}</label>
                <input className="input-field" type="number" min={0} step={0.5} value={form.price} onChange={(e) => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[var(--border-color)] flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="btn-secondary">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={createMutation.isPending || !form.title || !form.tutorId}
                className="btn-primary"
              >
                {createMutation.isPending ? (lang === 'ar' ? 'جاري الإنشاء...' : 'Creating...') : (lang === 'ar' ? 'إنشاء' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
