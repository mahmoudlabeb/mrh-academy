'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

type Lesson = {
  id: string;
  scheduledTime: string;
  tutorName: string;
  studentName: string;
  durationMinutes: number;
  status: string;
  meetUrl: string;
};

export default function LessonsTab() {
  const { lang } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const lessonsQuery = useQuery({
    queryKey: ['admin-lessons', statusFilter],
    queryFn: async () => {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const { data } = await apiClient.get<Lesson[]>(`/admin/lessons${params}`);
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--bg-light)', border: '1px solid var(--border-color)' }}>
          {['all', 'completed', 'cancelled', 'confirmed', 'pending'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                statusFilter === s ? 'text-white shadow-sm' : ''
              }`}
              style={statusFilter === s ? { background: '#D4A353', color: '#0F3A40' } : { color: 'var(--text-muted)' }}
            >
              {s === 'all' ? (lang === 'ar' ? 'الكل' : 'All') : s === 'completed' ? (lang === 'ar' ? 'مكتملة' : 'Completed') : s === 'cancelled' ? (lang === 'ar' ? 'ملغية' : 'Cancelled') : s === 'confirmed' ? (lang === 'ar' ? 'مؤكدة' : 'Confirmed') : (lang === 'ar' ? 'معلقة' : 'Pending')}
            </button>
          ))}
        </div>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {lessonsQuery.data?.length ?? 0} {lang === 'ar' ? 'درس' : 'lessons'}
        </span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-light)' }}>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'المدرس' : 'Tutor'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'الطالب' : 'Student'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'المدة' : 'Duration'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'معرف الغرفة' : 'Room ID'}</th>
              </tr>
            </thead>
            <tbody>
              {lessonsQuery.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-5 skeleton rounded w-4/5" /></td>
                    ))}
                  </tr>
                ))
              ) : lessonsQuery.data?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                    {lang === 'ar' ? 'لا توجد دروس' : 'No lessons found'}
                  </td>
                </tr>
              ) : (
                lessonsQuery.data?.map((lesson) => (
                  <tr key={lesson.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td className="px-4 py-3" style={{ color: 'var(--text-main)' }}>
                      {new Date(lesson.scheduledTime).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-main)' }}>{lesson.tutorName}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-main)' }}>{lesson.studentName}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{lesson.durationMinutes} {lang === 'ar' ? 'دقيقة' : 'min'}</td>
                    <td className="px-4 py-3">
                      <span className="badge text-xs"
                        style={lesson.status === 'completed' ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' } : lesson.status === 'cancelled' ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' } : lesson.status === 'confirmed' ? { background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' } : { background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' }}>
                        {lesson.status === 'completed' ? (lang === 'ar' ? 'مكتملة' : 'Completed') : lesson.status === 'cancelled' ? (lang === 'ar' ? 'ملغية' : 'Cancelled') : lesson.status === 'confirmed' ? (lang === 'ar' ? 'مؤكدة' : 'Confirmed') : (lang === 'ar' ? 'معلقة' : 'Pending')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-light)', color: 'var(--text-muted)' }}>{lesson.meetUrl}</code>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
