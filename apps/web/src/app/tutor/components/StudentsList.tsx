'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';
import Image from 'next/image';

type StudentInfo = {
  user: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
  lessonCount: number;
  totalHours: number;
};

export default function StudentsList() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';

  const t = (ar: string, en: string) => isAr ? ar : en;

  const { data: students = [], isLoading } = useQuery<StudentInfo[]>({
    queryKey: ['tutor', 'students'],
    queryFn: async () => {
      const { data } = await apiClient.get('/tutor/students');
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 skeleton" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-dark p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full skeleton" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-28 skeleton" />
                <div className="h-3 w-20 skeleton" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>{t('الطلاب', 'Students')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('الطلاب الذين حجزوا دروسًا معك.', 'Students who have booked lessons with you.')}</p>
      </div>

      <div className="space-y-3">
        {students.length === 0 ? (
          <div className="card-dark p-12 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('لا يوجد طلاب بعد', 'No students yet')}</p>
          </div>
        ) : (
          students.map((student) => (
            <div key={student.user.id} className="card-dark p-4 flex items-center gap-4 hover:translate-y-0">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0" style={{ background: 'rgba(212, 163, 83,0.15)', color: 'var(--primary-color)' }}>
                {student.user.avatarUrl ? (
                  <Image src={student.user.avatarUrl} alt="" width={48} height={48} className="w-full h-full rounded-full object-cover" />
                ) : (
                  (student.user.firstName?.[0] ?? '?')
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{student.user.firstName} {student.user.lastName}</p>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {t('الدروس:', 'Lessons:')} <span className="font-medium" style={{ color: 'var(--text-main)' }}>{student.lessonCount}</span>
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {t('الساعات:', 'Hours:')} <span className="font-medium" style={{ color: 'var(--text-main)' }}>{student.totalHours.toFixed(1)}</span>
                  </span>
                </div>
              </div>
              <button className="btn-outline-gold text-xs px-3 py-1.5">
                <svg className="w-3.5 h-3.5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                {t('تواصل', 'Contact')}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}