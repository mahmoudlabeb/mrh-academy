'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

type LessonStatus = 'scheduled' | 'completed' | 'cancelled';

interface Lesson {
  id: string;
  tutorName: string;
  subject: string;
  date: string;
  duration: number;
  price: number;
  status: LessonStatus;
}

interface FavoriteTutor {
  userId: string;
  firstName: string;
  lastName: string;
  specialization: string;
  hourlyRate: number;
  averageRating: number;
}

type SubTab = 'history' | 'calendar' | 'favorites';

const statusConfig: Record<LessonStatus, { labelAr: string; labelEn: string; bg: string; color: string }> = {
  scheduled: { labelAr: 'مؤكد', labelEn: 'Scheduled', bg: 'rgba(34,197,94,0.1)', color: '#22c55e' },
  completed: { labelAr: 'مكتمل', labelEn: 'Completed', bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
  cancelled: { labelAr: 'ملغي', labelEn: 'Cancelled', bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
};

export default function MyLessons() {
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => lang === 'ar' ? ar : en;
  const [subTab, setSubTab] = useState<SubTab>('history');

  const subTabs: { key: SubTab; labelAr: string; labelEn: string }[] = [
    { key: 'history', labelAr: 'سجل الدروس', labelEn: 'Lesson History' },
    { key: 'calendar', labelAr: 'التقويم', labelEn: 'Schedule Calendar' },
    { key: 'favorites', labelAr: 'المعلمون المفضلون', labelEn: 'Favorite Tutors' },
  ];

  const { data: lessons = [], isLoading: loadingLessons } = useQuery({
    queryKey: ['my-lessons'],
    queryFn: async () => {
      const { data } = await apiClient.get<Lesson[]>('/students/lessons');
      return data;
    },
  });

  const { data: favorites = [], isLoading: loadingFavorites } = useQuery({
    queryKey: ['favorite-tutors'],
    queryFn: async () => {
      const { data } = await apiClient.get<FavoriteTutor[]>('/students/favorite-tutors');
      return data;
    },
  });

  const lessonsByDate = lessons.reduce<Record<string, Lesson[]>>((acc, lesson) => {
    const day = lesson.date.split('T')[0];
    if (!acc[day]) acc[day] = [];
    acc[day].push(lesson);
    return acc;
  }, {});

  const today = new Date().toISOString().split('T')[0];
  const calendarDays = Object.keys(lessonsByDate).sort();

  return (
    <div>
      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'var(--bg-light)', border: '1px solid var(--border-color)' }}>
        {subTabs.map((st) => (
          <button
            key={st.key}
            onClick={() => setSubTab(st.key)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
              subTab === st.key
                ? 'shadow-sm'
                : 'hover:bg-white/5'
            }`}
            style={{
              background: subTab === st.key ? 'var(--bg-main)' : 'transparent',
              color: subTab === st.key ? 'var(--text-main)' : 'var(--text-muted)',
              border: subTab === st.key ? '1px solid var(--border-color)' : '1px solid transparent',
            }}
          >
            {lang === 'ar' ? st.labelAr : st.labelEn}
          </button>
        ))}
      </div>

      {subTab === 'history' && (
        <div>
          {loadingLessons ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-5">
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-40 skeleton" />
                      <div className="h-3 w-24 skeleton" />
                    </div>
                    <div className="h-8 w-20 skeleton rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : lessons.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(212, 163, 83,0.1)' }}>
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#D4A353">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>{t('لا توجد دروس بعد', 'No lessons yet')}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('احجز درساً مع معلم للبدء', 'Book a lesson with a tutor to get started')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lessons.map((lesson) => {
                const cfg = statusConfig[lesson.status];
                return (
                  <div key={lesson.id} className="card p-5 flex items-center justify-between gap-4 hover:translate-y-0">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(212, 163, 83,0.1)' }}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#D4A353">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-main)' }}>{lesson.tutorName}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{lesson.subject}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <span>{new Date(lesson.date).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                          <span>{lesson.duration} {t('دقيقة', 'min')}</span>
                          <span style={{ color: '#D4A353' }}>${lesson.price}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="badge text-xs font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
                        {lang === 'ar' ? cfg.labelAr : cfg.labelEn}
                      </span>
                      {lesson.status === 'scheduled' && (
                        <button className="btn-primary text-xs px-4 py-2">
                          {t('دخول الفصل', 'Enter Classroom')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === 'calendar' && (
        <div>
          {loadingLessons ? (
            <div className="card p-8">
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="aspect-square skeleton rounded-lg" />
                ))}
              </div>
            </div>
          ) : calendarDays.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(212, 163, 83,0.1)' }}>
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#D4A353">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>{t('لا توجد دروس مجدولة', 'No scheduled lessons')}</p>
            </div>
          ) : (
            <div className="card p-6">
              <div className="grid grid-cols-7 gap-1 mb-4">
                {(lang === 'ar' ? ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).map((d) => (
                  <div key={d} className="text-center text-xs font-semibold py-2" style={{ color: 'var(--text-muted)' }}>
                    {d}
                  </div>
                ))}
                {Array.from({ length: new Date(calendarDays[0]).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                {calendarDays.map((day) => {
                  const dayLessons = lessonsByDate[day];
                  const date = new Date(day);
                  const isToday = day === today;
                  return (
                    <div
                      key={day}
                      className={`aspect-square p-1 rounded-lg flex flex-col items-center justify-center text-xs cursor-pointer transition-colors hover:bg-white/5 ${
                        isToday ? 'ring-2 ring-[#D4A353]' : ''
                      }`}
                      style={{
                        background: dayLessons.some((l) => l.status === 'scheduled') ? 'rgba(212, 163, 83,0.1)' : 'transparent',
                      }}
                    >
                      <span className={`font-semibold ${isToday ? 'text-[#D4A353]' : ''}`} style={{ color: isToday ? undefined : 'var(--text-main)' }}>
                        {date.getDate()}
                      </span>
                      {dayLessons.length > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: '#D4A353' }} />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2 mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-main)' }}>
                  {t('الدروس القادمة', 'Upcoming Lessons')}
                </p>
                {lessons
                  .filter((l) => l.status === 'scheduled')
                  .slice(0, 5)
                  .map((lesson) => (
                    <div key={lesson.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-light)' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ background: '#D4A353', color: '#0F3A40' }}>
                        {new Date(lesson.date).getDate()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>{lesson.tutorName}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {new Date(lesson.date).toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                          {' · '}
                          {lesson.duration} {t('دقيقة', 'min')}
                        </p>
                      </div>
                      <button className="btn-primary text-xs px-3 py-1.5">
                        {t('دخول', 'Join')}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'favorites' && (
        <div>
          {loadingFavorites ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full skeleton" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-28 skeleton" />
                      <div className="h-3 w-20 skeleton" />
                    </div>
                  </div>
                  <div className="h-3 w-full skeleton" />
                </div>
              ))}
            </div>
          ) : favorites.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(212, 163, 83,0.1)' }}>
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#D4A353">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              </div>
              <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>{t('لا يوجد معلمون مفضلون', 'No favorite tutors')}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('ابحث عن معلمين وأضفهم إلى المفضلة', 'Search for tutors and add them to favorites')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {favorites.map((tutor) => (
                <div key={tutor.userId} className="card p-5 hover:translate-y-0">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0" style={{ background: '#D4A353' }}>
                      {tutor.firstName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-main)' }}>{tutor.firstName} {tutor.lastName}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{tutor.specialization}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1 text-sm">
                      <span style={{ color: '#D4A353' }}>{'★'.repeat(Math.round(tutor.averageRating))}</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({tutor.averageRating.toFixed(1)})</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: '#D4A353' }}>${tutor.hourlyRate}<span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/{t('ساعة', 'hr')}</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
