'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

type Lesson = {
  id: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  scheduledTime: string;
  durationMinutes: number;
  price: number;
  student: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
  meetUrl: string;
  googleMeetUrl: string | null;
};

export default function TutorLessonsPage() {
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'pending' | 'upcoming' | 'past'>('pending');
  const [error, setError] = useState<string | null>(null);

  const { data: lessons = [], isLoading } = useQuery<Lesson[]>({
    queryKey: ['tutor-lessons-page'],
    queryFn: async () => {
      const { data } = await apiClient.get<Lesson[]>('/lessons');
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      const { data } = await apiClient.patch(`/lessons/${lessonId}/approve`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutor-lessons-page'] });
      setError(null);
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      setError(e.response?.data?.message ?? t('ظپط´ظ„ ظ‚ط¨ظˆظ„ ط§ظ„ط¯ط±ط³', 'Failed to approve lesson'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      const { data } = await apiClient.patch(`/lessons/${lessonId}/reject`);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tutor-lessons-page'] }),
  });

  const pendingLessons  = lessons.filter(l => l.status === 'pending');
  const upcomingLessons = lessons.filter(l => l.status === 'confirmed');
  const pastLessons     = lessons.filter(l => l.status === 'completed' || l.status === 'cancelled');

  const tabLessons = activeTab === 'pending' ? pendingLessons :
                     activeTab === 'upcoming' ? upcomingLessons : pastLessons;

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

      {error && (
        <div className="mb-4 p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        {([
          { key: 'pending' as const, label: `${t('ط·ظ„ط¨ط§طھ ط¬ط¯ظٹط¯ط©', 'New Requests')} (${pendingLessons.length})` },
          { key: 'upcoming' as const, label: `${t('ظ‚ط§ط¯ظ…ط©', 'Upcoming')} (${upcomingLessons.length})` },
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
          {t('ظ„ط§ طھظˆط¬ط¯ ط¯ط±ظˆط³ ظپظٹ ظ‡ط°ط§ ط§ظ„ظ‚ط³ظ…', 'No lessons in this section')}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {tabLessons.map(lesson => (
            <div key={lesson.id} className="card-gold p-6 flex flex-col sm:flex-row sm:items-center gap-4" data-testid="lesson-card">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0" style={{ background: '#D4A353' }}>
                  {lesson.student.firstName?.[0] || 'S'}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold truncate" style={{ color: 'var(--text-main)' }}>
                    {lesson.student.firstName} {lesson.student.lastName}
                  </p>
                  <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
                    {new Date(lesson.scheduledTime).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                    {' آ· '}{lesson.durationMinutes} {t('ط¯ظ‚ظٹظ‚ط©', 'min')}{' آ· '}${lesson.price}
                  </p>
                </div>
              </div>

              {lesson.status === 'pending' && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => approveMutation.mutate(lesson.id)}
                    disabled={approveMutation.isPending}
                    className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #F3E1B9, #B89754)', color: '#0F3A40' }}>
                    {approveMutation.isPending ? '...' : t('ظ‚ط¨ظˆظ„', 'Approve')}
                  </button>
                  <button onClick={() => rejectMutation.mutate(lesson.id)}
                    disabled={rejectMutation.isPending}
                    className="px-4 py-2 rounded-lg text-sm font-semibold border disabled:opacity-50"
                    style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444' }}>
                    {rejectMutation.isPending ? '...' : t('ط±ظپط¶', 'Reject')}
                  </button>
                </div>
              )}

              {lesson.status === 'confirmed' && (
                <a href={`/classroom/${lesson.meetUrl}`}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, #F3E1B9, #B89754)', color: '#0F3A40' }}>
                  {t('ط¯ط®ظˆظ„ ط§ظ„ظپطµظ„', 'Join Classroom')}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

