'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';
import Link from 'next/link';

type Lesson = {
  id: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  scheduledTime: string;
  durationMinutes: number;
  price: number;
  meetUrl: string;
  googleMeetUrl: string | null;
  tutor: { firstName: string; lastName: string; avatarUrl: string | null };
};

export default function StudentLessonsPage() {
  const { t, lang } = useLanguage();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'pending' | 'past'>('upcoming');

  const { data: lessons = [], isLoading } = useQuery<Lesson[]>({
    queryKey: ['student-lessons-page'],
    queryFn: async () => {
      const { data } = await apiClient.get<Lesson[]>('/students/lessons');
      return data;
    },
  });

  const upcomingLessons = lessons.filter(l => l.status === 'confirmed');
  const pendingLessons  = lessons.filter(l => l.status === 'pending');
  const pastLessons     = lessons.filter(l => l.status === 'completed' || l.status === 'cancelled');

  const tabLessons = activeTab === 'upcoming' ? upcomingLessons :
                     activeTab === 'pending' ? pendingLessons : pastLessons;

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-8 h-8 border-2 border-[#D4A353] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-main)' }}>
        {t('ط¯ط±ظˆط³ظٹ', 'My Lessons')}
      </h1>

      <div className="flex gap-2 mb-6">
        {([
          { key: 'upcoming' as const, label: `${t('ظ‚ط§ط¯ظ…ط©', 'Upcoming')} (${upcomingLessons.length})` },
          { key: 'pending' as const, label: `${t('ط¨ط§ظ†طھط¸ط§ط± ط§ظ„ظ‚ط¨ظˆظ„', 'Pending')} (${pendingLessons.length})` },
          { key: 'past' as const, label: t('ط³ط§ط¨ظ‚ط©', 'Past') },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={activeTab === tab.key
              ? { background: 'linear-gradient(135deg, #F3E1B9, #B89754)', color: '#0F3A40' }
              : { background: 'var(--bg-light)', color: 'var(--text-muted)' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {tabLessons.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          {activeTab === 'upcoming' ? (
            <>{t('ظ„ط§ طھظˆط¬ط¯ ط¯ط±ظˆط³ ظ‚ط§ط¯ظ…ط©.', 'No upcoming lessons.')} <Link href="/student/discover" className="link">{t('ط§ط­ط¬ط² ط£ظˆظ„ ط¯ط±ط³ ظ„ظƒ', 'Book your first lesson')}</Link></>
          ) : (
            t('ظ„ط§ طھظˆط¬ط¯ ط¯ط±ظˆط³ ظپظٹ ظ‡ط°ط§ ط§ظ„ظ‚ط³ظ…', 'No lessons in this section')
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {tabLessons.map(lesson => (
            <div key={lesson.id} className="card-gold p-6 flex flex-col sm:flex-row sm:items-center gap-4" data-testid="lesson-card">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0" style={{ background: '#D4A353' }}>
                  {lesson.tutor.firstName?.[0] || 'T'}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold truncate" style={{ color: 'var(--text-main)' }}>
                    {lesson.tutor.firstName} {lesson.tutor.lastName}
                  </p>
                  <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
                    {new Date(lesson.scheduledTime).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                    {' آ· '}{lesson.durationMinutes} {t('ط¯ظ‚ظٹظ‚ط©', 'min')}{' آ· '}${lesson.price}
                  </p>
                </div>
              </div>

              {lesson.status === 'confirmed' && (
                <div className="flex gap-2 shrink-0">
                  <a href={`/classroom/${lesson.meetUrl}`}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-center"
                    style={{ background: 'linear-gradient(135deg, #F3E1B9, #B89754)', color: '#0F3A40' }}>
                    {t('ط¯ط®ظˆظ„ ط§ظ„ظپطµظ„', 'Join Classroom')}
                  </a>
                  {lesson.googleMeetUrl && (
                    <a href={lesson.googleMeetUrl} target="_blank" rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg text-sm font-semibold text-center"
                      style={{ background: 'var(--bg-light)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                      Google Meet
                    </a>
                  )}
                </div>
              )}

              {lesson.status === 'pending' && (
                <span className="badge text-sm shrink-0" style={{ background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' }}>
                  {t('ط¨ط§ظ†طھط¸ط§ط± ط§ظ„ظ‚ط¨ظˆظ„', 'Awaiting Approval')}
                </span>
              )}

              {lesson.status === 'completed' && (
                <span className="badge text-sm shrink-0" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                  {t('ظ…ظƒطھظ…ظ„', 'Completed')}
                </span>
              )}

              {lesson.status === 'cancelled' && (
                <span className="badge text-sm shrink-0" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {t('ظ…ظ„ط؛ظٹ', 'Cancelled')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

