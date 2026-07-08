'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

type TutorStats = {
  completedLessons: number;
  totalHoursTaught: number;
  totalEarnings: number;
  reviewCount: number;
  averageRating: number;
};

type LessonBrief = {
  id: string;
  student?: { firstName?: string; lastName?: string } | null;
  status: string;
  scheduledTime: string;
  price: number;
  durationMinutes: number;
};

export default function Insights() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';

  const t = (ar: string, en: string) => isAr ? ar : en;

  const { data: stats, isLoading } = useQuery<TutorStats>({
    queryKey: ['tutor', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/tutors/me/stats');
      return data;
    },
  });

  const { data: recentLessons = [] } = useQuery<LessonBrief[]>({
    queryKey: ['tutor', 'recent-lessons'],
    queryFn: async () => {
      const { data } = await apiClient.get('/lessons');
      return (data ?? []).slice(0, 5);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-48 skeleton" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-dark p-5">
              <div className="h-8 w-8 skeleton rounded-xl mb-3" />
              <div className="h-4 w-20 skeleton" />
              <div className="h-8 w-16 skeleton mt-2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      labelAr: 'الدروس المكتملة',
      labelEn: 'Completed Lessons',
      value: String(stats?.completedLessons ?? 0),
      color: '#D4A353',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      ),
    },
    {
      labelAr: 'الأرباح',
      labelEn: 'Earnings',
      value: `$${(stats?.totalEarnings ?? 0).toFixed(0)}`,
      color: '#22c55e',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      labelAr: 'متوسط التقييم',
      labelEn: 'Average Rating',
      value: `${(stats?.averageRating ?? 0).toFixed(1)} ★`,
      color: '#eab308',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      ),
    },
    {
      labelAr: 'إجمالي ساعات التدريس',
      labelEn: 'Total Hours Taught',
      value: `${(stats?.totalHoursTaught ?? 0).toFixed(1)}h`,
      color: '#6366f1',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>{t('التحليلات', 'Insights')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('تحليلات أدائك التعليمي.', 'Your teaching performance analytics.')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.labelEn} className="card-dark p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}15` }}>
                <span style={{ color: stat.color }}>{stat.icon}</span>
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{t(stat.labelAr, stat.labelEn)}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="card-dark p-6">
        <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-main)' }}>{t('الدروس الأخيرة', 'Recent Lessons')}</h3>
        <div className="space-y-3">
          {recentLessons.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('لا توجد دروس حديثة', 'No recent lessons')}</p>
          ) : (
            recentLessons.map((lesson: LessonBrief) => (
              <div key={lesson.id} className="flex items-center gap-4 py-3 border-b last:border-0" style={{ borderColor: 'var(--border-color)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(212, 163, 83,0.12)', color: 'var(--primary-color)' }}>
                  {lesson.student?.firstName?.[0] ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
                    {lesson.student ? `${lesson.student.firstName} ${lesson.student.lastName}` : t('طالب', 'Student')}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{lesson.status}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    {new Date(lesson.scheduledTime).toLocaleDateString()}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{lesson.durationMinutes} {t('دقيقة', 'min')}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}