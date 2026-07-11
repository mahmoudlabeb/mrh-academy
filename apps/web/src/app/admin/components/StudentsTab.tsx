'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { setAuthTokenCookie } from '@/lib/auth-cookie';
import { useLanguage } from '@/contexts/language-context';

type Student = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  balance: number;
  totalLessons: number;
};

type Lesson = {
  id: string;
  scheduledTime: string;
  durationMinutes: number;
  status: string;
  tutor?: { firstName: string; lastName: string };
};

export default function StudentsTab() {
  const { lang } = useLanguage();
  // Removed unused user variable
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const studentsQuery = useQuery({
    queryKey: ['admin-students'],
    queryFn: async () => {
      const { data } = await apiClient.get<Student[]>('/admin/students');
      return data;
    },
  });

  const lessonsQuery = useQuery({
    queryKey: ['student-lessons', expandedId],
    queryFn: async () => {
      if (!expandedId) return [];
      const { data } = await apiClient.get<Lesson[]>(`/admin/students/${expandedId}/lessons`);
      return data;
    },
    enabled: !!expandedId,
  });

  const filtered = studentsQuery.data?.filter((s) =>
    `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleImpersonate = async (studentId: string) => {
    try {
      const { data } = await apiClient.post('/admin/impersonate', { userId: studentId });
      if (data.accessToken) {
        setAuthTokenCookie(data.accessToken);
        window.location.href = '/';
      }
    } catch {
      // silent
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input
          className="input-field max-w-sm"
          placeholder={lang === 'ar' ? 'بحث عن طالب...' : 'Search students...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {studentsQuery.data?.length ?? 0} {lang === 'ar' ? 'طالب' : 'students'}
        </span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-light)' }}>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'الرصيد' : 'Balance'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'عدد الدروس' : 'Lessons'}</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {studentsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-5 skeleton rounded w-3/4" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                    {lang === 'ar' ? 'لا يوجد طلاب' : 'No students found'}
                  </td>
                </tr>
              ) : (
                filtered?.map((student) => (
                  <React.Fragment key={student.id}>
                    <tr
                      key={student.id}
                      className="cursor-pointer transition-all"
                      style={{ borderBottom: '1px solid var(--border-color)' }}
                      onClick={() => setExpandedId(expandedId === student.id ? null : student.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: '#D4A353' }}>
                            {student.firstName[0]}
                          </div>
                          <span className="font-medium" style={{ color: 'var(--text-main)' }}>{student.firstName} {student.lastName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{student.email}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: '#22c55e' }}>${student.balance.toFixed(2)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-main)' }}>{student.totalLessons}</td>
                      <td className="px-4 py-3 text-left">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleImpersonate(student.id); }}
                          className="btn-ghost px-3 py-1 text-xs"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                          {lang === 'ar' ? 'انتحال' : 'Impersonate'}
                        </button>
                      </td>
                    </tr>
                    {expandedId === student.id && (
                      <tr key={`${student.id}-lessons`}>
                        <td colSpan={5} className="px-4 py-4" style={{ background: 'var(--bg-light)' }}>
                          <div className="animate-slide-up">
                            <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-main)' }}>
                              {lang === 'ar' ? 'سجل الدروس' : 'Lesson History'}
                            </h4>
                            {lessonsQuery.isLoading ? (
                              <div className="space-y-2">
                                {Array.from({ length: 3 }).map((_, i) => (
                                  <div key={i} className="h-10 skeleton rounded" />
                                ))}
                              </div>
                            ) : lessonsQuery.data?.length === 0 ? (
                              <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                                {lang === 'ar' ? 'لا توجد دروس مسجلة' : 'No lessons recorded'}
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {lessonsQuery.data?.map((lesson) => (
                                  <div key={lesson.id} className="flex items-center justify-between px-4 py-2 rounded-lg" style={{ border: '1px solid var(--border-color)', background: 'var(--bg-main)' }}>
                                    <div>
                                      <p className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>{lesson.tutor ? `${lesson.tutor.firstName} ${lesson.tutor.lastName}` : 'Unknown'}</p>
                                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(lesson.scheduledTime).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')} &middot; {lesson.durationMinutes}{lang === 'ar' ? ' دقيقة' : ' min'}</p>
                                    </div>
                                    <span className="badge text-xs" style={lesson.status === 'completed' ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e' } : { background: 'rgba(234,179,8,0.1)', color: '#eab308' }}>
                                      {lesson.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
