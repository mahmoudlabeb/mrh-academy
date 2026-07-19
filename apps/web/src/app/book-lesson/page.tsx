'use client';

import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';

interface TutorProfile {
  userId: string;
  specialization: string;
  languages: string[];
  hourlyRate: number;
  averageRating: number;
  reviewCount: number;
  user: { firstName: string; lastName: string; avatarUrl?: string };
}

interface AvailabilitySlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const DAY_LABELS_AR_SHORT = ['ط£ط­ط¯', 'ط¥ط«ظ†ظٹظ†', 'ط«ظ„ط§ط«ط§ط،', 'ط£ط±ط¨ط¹ط§ط،', 'ط®ظ…ظٹط³', 'ط¬ظ…ط¹ط©', 'ط³ط¨طھ'] as const;
const MONTH_NAMES_AR = [
  'ظٹظ†ط§ظٹط±', 'ظپط¨ط±ط§ظٹط±', 'ظ…ط§ط±ط³', 'ط£ط¨ط±ظٹظ„', 'ظ…ط§ظٹظˆ', 'ظٹظˆظ†ظٹظˆ',
  'ظٹظˆظ„ظٹظˆ', 'ط£ط؛ط³ط·ط³', 'ط³ط¨طھظ…ط¨ط±', 'ط£ظƒطھظˆط¨ط±', 'ظ†ظˆظپظ…ط¨ط±', 'ط¯ظٹط³ظ…ط¨ط±',
];
const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5 text-sm">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < Math.round(rating) ? 'text-amber-400' : 'text-slate-200'}>
          &#9733;
        </span>
      ))}
    </span>
  );
}

  

function formatDateToISO(date: Date) {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const dynamic = 'force-dynamic';

function BookLessonContent() {
  const searchParams = useSearchParams();
  const { t, lang } = useLanguage();
  const { user } = useAuth();

  const tutorId = searchParams.get('tutorId');

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('12:00');
  const [duration, setDuration] = useState<25 | 50>(25);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const { data: tutor, isLoading: tutorLoading, error: tutorError } = useQuery({
    queryKey: ['tutor', tutorId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/tutors/${tutorId}`);
      return data as TutorProfile;
    },
    enabled: !!tutorId,
  });

  const { data: availability } = useQuery({
    queryKey: ['availability', tutorId],
    queryFn: async () => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const { data } = await apiClient.get(`/tutors/${tutorId}/availability`, {
        params: { timezone: tz },
      });
      return data as AvailabilitySlot[];
    },
    enabled: !!tutorId,
  });

  const { data: userData } = useQuery({
    queryKey: ['users-me'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ studentProfile?: { balance: number } }>('/users/me');
      return data;
    },
  });

  const balance = userData?.studentProfile?.balance ?? 0;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const calendarDays = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];

    const startPad = firstDay.getDay();

    for (let i = 0; i < startPad; i++) {
      days.push(null);
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }

    return days;
  }, [calendarMonth]);

  const availableDates = useMemo(() => {
    if (!availability) return new Set<string>();
    const daySet = new Set(availability.map((s) => s.dayOfWeek));
    const dates = new Set<string>();
    const { year, month } = calendarMonth;
    const lastDay = new Date(year, month + 1, 0).getDate();

    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(year, month, d);
      if (daySet.has(date.getDay())) {
        dates.add(formatDateToISO(date));
      }
    }
    return dates;
  }, [availability, calendarMonth]);

  const isViewingCurrentMonth =
    calendarMonth.year === today.getFullYear() &&
    calendarMonth.month === today.getMonth();

  const totalCost = tutor ? (tutor.hourlyRate * duration) / 60 : 0;
  const insufficientBalance = balance < totalCost;

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !tutorId) throw new Error('Missing booking info');
      const tzOffset = -new Date().getTimezoneOffset();
      const sign = tzOffset >= 0 ? '+' : '-';
      const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');
      const tz = `${sign}${pad(Math.floor(tzOffset / 60))}:${pad(tzOffset % 60)}`;
      const scheduledTime = `${formatDateToISO(selectedDate)}T${selectedTime}:00${tz}`;
      const { data } = await apiClient.post('/lessons/book', {
        tutorId,
        scheduledTime,
        durationMinutes: duration,
      });
      return data;
    },
    onSuccess: () => {
      setBookingSuccess(true);
    },
    onError: (err: Error) => {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg = axiosErr?.response?.data?.message || err?.message || 'ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط§ظ„ط­ط¬ط²';
      setErrorMsg(msg);
    },
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const canBook = selectedDate && tutorId && !insufficientBalance;

  const prevMonth = () => {
    if (isViewingCurrentMonth) return;
    setCalendarMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const nextMonth = () => {
    setCalendarMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const handleDateSelect = (date: Date) => {
    if (date < today) return;
    const iso = formatDateToISO(date);
    if (!availableDates.has(iso)) return;
    setSelectedDate(date);
    setErrorMsg(null);
  };

  if (user && user.role !== 'student') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="text-center card p-12 max-w-md">
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>
            {t('ط§ظ„ط­ط¬ط² ظ„ظ„ط·ظ„ط§ط¨ ظپظ‚ط·', 'Booking is for students only')}
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {t('ظٹط¬ط¨ طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„ ط¨ط­ط³ط§ط¨ ط·ط§ظ„ط¨ ظ„ط­ط¬ط² ط¯ط±ط³.', 'You must be logged in as a student to book a lesson.')}
          </p>
          <Link href={user.role === 'tutor' ? '/tutor' : user.role === 'admin' || user.role === 'subadmin' ? '/admin' : '/student'} className="btn-primary">
            {t('ط§ظ„ط¹ظˆط¯ط© ظ„ظ„ظˆط­ط© ط§ظ„طھط­ظƒظ…', 'Back to Dashboard')}
          </Link>
        </div>
      </div>
    );
  }

  if (!tutorId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="text-center card p-12 max-w-md">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(212, 163, 83,0.1)' }}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#D4A353">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>
            {t('ظ„ظ… ظٹطھظ… ط§ط®طھظٹط§ط± ظ…ط¹ظ„ظ…', 'No tutor selected')}
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {t('ط§ظ„ط±ط¬ط§ط، ط§ط®طھظٹط§ط± ظ…ط¹ظ„ظ… ط£ظˆظ„ط§ظ‹ ظ…ظ† طµظپط­ط© ط§ظ„ظ…ط¹ظ„ظ…ظٹظ†.', 'Please select a tutor first from the tutors page.')}
          </p>
          <Link href="/student/discover" className="btn-primary">
            {t('طھطµظپط­ ط§ظ„ظ…ط¹ظ„ظ…ظٹظ†', 'Browse Tutors')}
          </Link>
        </div>
      </div>
    );
  }

  if (tutorLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--border-color)', borderTopColor: '#D4A353' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('ط¬ط§ط±ظٹ طھط­ظ…ظٹظ„ ط¨ظٹط§ظ†ط§طھ ط§ظ„ظ…ط¹ظ„ظ…...', 'Loading tutor data...')}</p>
        </div>
      </div>
    );
  }

  if (bookingSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="text-center card p-12 max-w-md animate-scale-in">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(212, 163, 83,0.1)' }}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#D4A353">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>
            {t('طھظ… ط¥ط±ط³ط§ظ„ ط·ظ„ط¨ ط§ظ„ط­ط¬ط²', 'Booking Request Sent')}
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {t('ط¨ط§ظ†طھط¸ط§ط± ظ…ظˆط§ظپظ‚ط© ط§ظ„ظ…ط¹ظ„ظ… ط¹ظ„ظ‰ ط§ظ„ط­ط¬ط² ظˆط§ط®طھظٹط§ط± ط§ظ„ظˆظ‚طھ ط§ظ„ظ…ظ†ط§ط³ط¨. ط³ظ†ط±ط³ظ„ ظ„ظƒ ط¥ط´ط¹ط§ط±ط§ظ‹ ط¹ظ†ط¯ ط§ظ„طھط£ظƒظٹط¯.', 'Awaiting tutor approval and time selection. You will be notified once confirmed.')}
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/student?tab=lessons" className="btn-primary">
              {t('ط¹ط±ط¶ ط¯ط±ظˆط³ظٹ', 'My Lessons')}
            </Link>
            <Link href="/student/discover" className="btn-secondary">
              {t('ط§ظ„ط¹ظˆط¯ط© ظ„ظ„ظ…ط¹ظ„ظ…ظٹظ†', 'Back to Tutors')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (tutorError || !tutor) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="text-center card p-12 max-w-md">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#ef4444">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>
            {t('ط®ط·ط£ ظپظٹ طھط­ظ…ظٹظ„ ط§ظ„ظ…ط¹ظ„ظ…', 'Error loading tutor')}
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {t('ظ„ظ… ظ†طھظ…ظƒظ† ظ…ظ† ط§ظ„ط¹ط«ظˆط± ط¹ظ„ظ‰ ظ‡ط°ط§ ط§ظ„ظ…ط¹ظ„ظ…. ظ‚ط¯ ظٹظƒظˆظ† ط؛ظٹط± ظ…طھط§ط­ ط­ط§ظ„ظٹط§ظ‹.', 'Could not find this tutor. They may not be available.')}
          </p>
          <Link href="/student/discover" className="btn-primary">
            {t('ط§ظ„ط¹ظˆط¯ط© ظ„ظ„ظ…ط¹ظ„ظ…ظٹظ†', 'Back to Tutors')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <header className="dashboard-header">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/student/discover"
            className="link inline-flex items-center gap-1 text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={lang === 'ar' ? 'M15 19l-7-7 7-7' : 'M19 15l-7-7 7-7'} />
            </svg>
            {t('ط§ظ„ط¹ظˆط¯ط© ط¥ظ„ظ‰ ط§ظ„ظ…ط¹ظ„ظ…ظٹظ†', 'Back to Tutors')}
          </Link>
          <Link href="/" className="logo text-xl font-extrabold tracking-tight" style={{ color: '#D4A353', fontFamily: "'Inter', sans-serif" }}>
            MR.H
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-8 text-center animate-fade-in" style={{ color: 'var(--text-main)' }}>
          {t('ط§ط­ط¬ط² ط¯ط±ط³ظ‹ط§', 'Book a Lesson')}
        </h1>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl animate-scale-in flex items-start gap-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="#ef4444">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm" style={{ color: '#ef4444' }}>{errorMsg}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="card p-6 animate-slide-up">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg shrink-0" style={{ background: '#D4A353' }}>
                  {tutor.user.firstName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>
                    {tutor.user.firstName} {tutor.user.lastName}
                  </h2>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {tutor.specialization}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <div className="flex items-center gap-1">
                      <StarRating rating={tutor.averageRating} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        ({tutor.reviewCount})
                      </span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: '#D4A353' }}>
                      ${tutor.hourlyRate}/{t('ط³ط§ط¹ط©', 'hr')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tutor.languages?.map((lang) => (
                      <span key={lang} className="badge text-[10px]" style={{ background: 'rgba(212, 163, 83,0.1)', color: '#D4A353', border: '1px solid rgba(212, 163, 83,0.2)' }}>
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card p-6 animate-slide-up">
              <h3 className="text-base font-bold mb-4" style={{ color: 'var(--text-main)' }}>
                {t('ظ…ط¯ط© ط§ظ„ط¯ط±ط³', 'Lesson Duration')}
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={() => { setDuration(25); }}
                  className={`flex-1 py-3.5 rounded-xl text-sm font-bold transition-all ${
                    duration === 25
                      ? 'bg-[#D4A353] text-[#0F3A40] shadow-md'
                      : 'border text-[var(--text-main)] hover:border-[#D4A353]'
                  }`}
                  style={duration !== 25 ? { borderColor: 'var(--border-color)', background: 'var(--bg-light)' } : {}}
                >
                  {t('ظ¢ظ¥ ط¯ظ‚ظٹظ‚ط©', '25 min')}
                  <span className="block text-[10px] font-medium mt-0.5" style={{ opacity: 0.8 }}>
                    ${((tutor.hourlyRate * 25) / 60).toFixed(2)}
                  </span>
                </button>
                <button
                  onClick={() => { setDuration(50); }}
                  className={`flex-1 py-3.5 rounded-xl text-sm font-bold transition-all ${
                    duration === 50
                      ? 'bg-[#D4A353] text-[#0F3A40] shadow-md'
                      : 'border text-[var(--text-main)] hover:border-[#D4A353]'
                  }`}
                  style={duration !== 50 ? { borderColor: 'var(--border-color)', background: 'var(--bg-light)' } : {}}
                >
                  {t('ظ¥ظ  ط¯ظ‚ظٹظ‚ط©', '50 min')}
                  <span className="block text-[10px] font-medium mt-0.5" style={{ opacity: 0.8 }}>
                    ${((tutor.hourlyRate * 50) / 60).toFixed(2)}
                  </span>
                </button>
              </div>
            </div>

            <div className="card p-6 animate-slide-up">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
                  {t('ط§ط®طھط± ط§ظ„طھط§ط±ظٹط®', 'Select Date')}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={prevMonth}
                    disabled={isViewingCurrentMonth}
                    className="p-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={lang === 'ar' ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
                    </svg>
                  </button>
                  <span className="text-sm font-semibold min-w-[120px] text-center" style={{ color: 'var(--text-main)' }}>
                    {lang === 'ar' ? MONTH_NAMES_AR[calendarMonth.month] : MONTH_NAMES_EN[calendarMonth.month]} {calendarMonth.year}
                  </span>
                  <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--text-muted)' }}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={lang === 'ar' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-1">
                {(lang === 'ar' ? DAY_LABELS_AR_SHORT : DAY_LABELS).map((label, idx) => (
                  <div key={`${label}-${idx}`} className="text-center text-xs font-semibold py-2" style={{ color: 'var(--text-muted)' }}>
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((date, idx) => {
                  if (!date) {
                    return <div key={`empty-${idx}`} />;
                  }

                  const iso = formatDateToISO(date);
                  const isPast = date < today;
                  const hasAvailability = availableDates.has(iso);
                  const isSelected = selectedDate && formatDateToISO(selectedDate) === iso;
                  const isToday = formatDateToISO(date) === formatDateToISO(today);

                  const canSelect = !isPast && hasAvailability;

                  return (
                    <button
                      key={iso}
                      disabled={!canSelect}
                      onClick={() => handleDateSelect(date)}
                      className={`relative py-2.5 text-sm rounded-lg font-medium transition-all ${
                        isSelected
                          ? 'bg-[#D4A353] text-[#0F3A40] font-bold shadow-md'
                          : canSelect
                            ? 'text-[var(--text-main)] hover:bg-white/5 cursor-pointer'
                            : 'text-[var(--text-muted)] opacity-30 cursor-not-allowed'
                      }`}
                      style={
                        !isSelected && canSelect && isToday
                          ? { border: '1px solid rgba(212, 163, 83,0.3)' }
                          : {}
                      }
                    >
                      {date.getDate()}
                      {hasAvailability && !isSelected && canSelect && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#D4A353]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDate && (
              <div className="card p-6 animate-scale-in">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(212, 163, 83,0.1)' }}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#D4A353">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
                      {t('ط§ظ„ظٹظˆظ… ظˆط§ظ„ظˆظ‚طھ ط§ظ„ظ…ط­ط¯ط¯', 'Selected Day & Time')}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {selectedDate.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-main)' }}>
                    {t('ط§ط®طھط± ط§ظ„ظˆظ‚طھ', 'Select Time')}
                  </label>
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="input-field w-full"
                    style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '0.625rem 0.875rem', color: 'var(--text-main)' }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="card p-6 animate-slide-up sticky top-6" style={{ background: 'var(--bg-light)' }}>
              <h3 className="text-base font-bold mb-5" style={{ color: 'var(--text-main)' }}>
                {t('ظ…ظ„ط®طµ ط§ظ„ط­ط¬ط²', 'Booking Summary')}
              </h3>

              <div className="space-y-3.5">
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>{t('ط§ظ„ظ…ط¹ظ„ظ…', 'Tutor')}</span>
                  <span className="font-medium" style={{ color: 'var(--text-main)' }}>
                    {tutor.user.firstName} {tutor.user.lastName}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>{t('ط§ظ„ظ…ط¯ط©', 'Duration')}</span>
                  <span className="font-medium" style={{ color: 'var(--text-main)' }}>
                    {duration === 25 ? t('ظ¢ظ¥ ط¯ظ‚ظٹظ‚ط©', '25 min') : t('ظ¥ظ  ط¯ظ‚ظٹظ‚ط©', '50 min')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>{t('ط§ظ„ط³ط¹ط±', 'Rate')}</span>
                  <span className="font-medium" style={{ color: 'var(--text-main)' }}>
                    ${tutor.hourlyRate}/{t('ط³ط§ط¹ط©', 'hr')}
                  </span>
                </div>

                {selectedDate && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>{t('ط§ظ„ظٹظˆظ…', 'Day')}</span>
                    <span className="font-medium" style={{ color: 'var(--text-main)' }}>
                      {selectedDate.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                )}

                <hr style={{ borderColor: 'var(--border-color)' }} />

                <div className="flex items-center justify-between">
                  <span className="font-bold" style={{ color: 'var(--text-main)' }}>
                    {t('ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ', 'Total')}
                  </span>
                  <span className="text-xl font-bold" style={{ color: '#D4A353' }}>
                    ${totalCost.toFixed(2)}
                  </span>
                </div>

                <hr style={{ borderColor: 'var(--border-color)' }} />

                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>{t('ط§ظ„ط±طµظٹط¯ ط§ظ„ظ…طھط§ط­', 'Your Balance')}</span>
                  <span className="font-medium" style={{ color: 'var(--text-main)' }}>
                    ${(balance ?? 0).toFixed(2)}
                  </span>
                </div>

                {insufficientBalance && (
                  <div className="p-3 rounded-xl text-xs flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="#ef4444">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span style={{ color: '#ef4444' }}>
                      {t('ط±طµظٹط¯ظƒ ط؛ظٹط± ظƒط§ظپظچ. ظٹط±ط¬ظ‰ ط´ط­ظ† ط±طµظٹط¯ظƒ ظ„ظ„ظ…طھط§ط¨ط¹ط©.', 'Insufficient balance. Please add credits to continue.')}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() => bookMutation.mutate()}
                disabled={!canBook || bookMutation.isPending}
                className="btn-primary w-full mt-6 py-3.5 text-base font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
              >
                {bookMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-[#0F3A40] border-t-transparent animate-spin" />
                    {t('ط¬ط§ط±ظٹ ط§ظ„ط­ط¬ط²...', 'Booking...')}
                  </span>
                ) : (
                  t('ط§ط­ط¬ط² ط§ظ„ط¢ظ†', 'Book Now')
                )}
              </button>

              {!selectedDate && (
                <p className="text-xs text-center mt-3" style={{ color: 'var(--text-muted)' }}>
                  {t('ط§ط®طھط± طھط§ط±ظٹط®ط§ظ‹ ظˆظˆظ‚طھط§ظ‹ ظ„ظ„ظ…طھط§ط¨ط¹ط©', 'Select a date and time to continue')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookLessonPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}><div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--border-color)', borderTopColor: '#D4A353' }} /></div>}>
      <BookLessonContent />
    </React.Suspense>
  );
}


