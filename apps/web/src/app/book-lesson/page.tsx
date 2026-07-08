'use client';

import React, { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';
import Link from 'next/link';

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
const DAY_LABELS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] as const;
const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
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

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

function parseTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
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
  const router = useRouter();
  const { lang } = useLanguage();

  const tutorId = searchParams.get('tutorId');

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [duration, setDuration] = useState<25 | 50>(25);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const t = (ar: string, en: string) => (lang === 'ar' ? ar : en);

  const { data: tutor, isLoading: tutorLoading, error: tutorError } = useQuery({
    queryKey: ['tutor', tutorId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/tutors/${tutorId}`);
      return data as TutorProfile;
    },
    enabled: !!tutorId,
  });

  const { data: availability, isLoading: availabilityLoading } = useQuery({
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

  const availableSlots = useMemo(() => {
    if (!selectedDate || !availability) return [];
    const dayOfWeek = selectedDate.getDay();
    const daySlots = availability.filter((s) => s.dayOfWeek === dayOfWeek);

    const slots: string[] = [];
    for (const slot of daySlots) {
      const start = parseTime(slot.startTime);
      const end = parseTime(slot.endTime);
      for (let t = start; t + duration <= end; t += 30) {
        const h = Math.floor(t / 60);
        const m = t % 60;
        const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        slots.push(timeStr);
      }
    }
    return slots;
  }, [selectedDate, availability, duration]);

  const totalCost = tutor ? (tutor.hourlyRate * duration) / 60 : 0;
  const insufficientBalance = balance < totalCost;

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !selectedTime || !tutorId) throw new Error('Missing booking info');
      const [h, m] = selectedTime.split(':').map(Number);
      const scheduledDate = new Date(selectedDate);
      scheduledDate.setHours(h, m, 0, 0);
      const { data } = await apiClient.post('/lessons/book', {
        tutorId,
        scheduledTime: scheduledDate.toISOString(),
        durationMinutes: duration,
      });
      return data;
    },
    onSuccess: () => {
      router.push('/student?tab=lessons');
    },
    onError: (err: Error) => {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg = axiosErr?.response?.data?.message || err?.message || 'حدث خطأ أثناء الحجز';
      setErrorMsg(msg);
    },
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canBook = selectedDate && selectedTime && tutorId && !insufficientBalance;

  const prevMonth = () => {
    setCalendarMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
    setSelectedTime(null);
  };

  const nextMonth = () => {
    setCalendarMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
    setSelectedTime(null);
  };

  const handleDateSelect = (date: Date) => {
    if (date < today) return;
    const iso = formatDateToISO(date);
    if (!availableDates.has(iso)) return;
    setSelectedDate(date);
    setSelectedTime(null);
    setErrorMsg(null);
  };

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
            {t('لم يتم اختيار معلم', 'No tutor selected')}
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {t('الرجاء اختيار معلم أولاً من صفحة المعلمين.', 'Please select a tutor first from the tutors page.')}
          </p>
          <Link href="/student/discover" className="btn-primary">
            {t('تصفح المعلمين', 'Browse Tutors')}
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
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('جاري تحميل بيانات المعلم...', 'Loading tutor data...')}</p>
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
            {t('خطأ في تحميل المعلم', 'Error loading tutor')}
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {t('لم نتمكن من العثور على هذا المعلم. قد يكون غير متاح حالياً.', 'Could not find this tutor. They may not be available.')}
          </p>
          <Link href="/student/discover" className="btn-primary">
            {t('العودة للمعلمين', 'Back to Tutors')}
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
            {t('العودة إلى المعلمين', 'Back to Tutors')}
          </Link>
          <Link href="/" className="logo text-xl font-extrabold tracking-tight" style={{ color: '#D4A353', fontFamily: "'Inter', sans-serif" }}>
            MR.H
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-8 text-center animate-fade-in" style={{ color: 'var(--text-main)' }}>
          {t('احجز درسًا', 'Book a Lesson')}
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
                      ${tutor.hourlyRate}/{t('ساعة', 'hr')}
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
                {t('مدة الدرس', 'Lesson Duration')}
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={() => { setDuration(25); setSelectedTime(null); }}
                  className={`flex-1 py-3.5 rounded-xl text-sm font-bold transition-all ${
                    duration === 25
                      ? 'bg-[#D4A353] text-[#0F3A40] shadow-md'
                      : 'border text-[var(--text-main)] hover:border-[#D4A353]'
                  }`}
                  style={duration !== 25 ? { borderColor: 'var(--border-color)', background: 'var(--bg-light)' } : {}}
                >
                  {t('٢٥ دقيقة', '25 min')}
                  <span className="block text-[10px] font-medium mt-0.5" style={{ opacity: 0.8 }}>
                    ${((tutor.hourlyRate * 25) / 60).toFixed(2)}
                  </span>
                </button>
                <button
                  onClick={() => { setDuration(50); setSelectedTime(null); }}
                  className={`flex-1 py-3.5 rounded-xl text-sm font-bold transition-all ${
                    duration === 50
                      ? 'bg-[#D4A353] text-[#0F3A40] shadow-md'
                      : 'border text-[var(--text-main)] hover:border-[#D4A353]'
                  }`}
                  style={duration !== 50 ? { borderColor: 'var(--border-color)', background: 'var(--bg-light)' } : {}}
                >
                  {t('٥٠ دقيقة', '50 min')}
                  <span className="block text-[10px] font-medium mt-0.5" style={{ opacity: 0.8 }}>
                    ${((tutor.hourlyRate * 50) / 60).toFixed(2)}
                  </span>
                </button>
              </div>
            </div>

            <div className="card p-6 animate-slide-up">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
                  {t('اختر التاريخ', 'Select Date')}
                </h3>
                <div className="flex items-center gap-2">
                  <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--text-muted)' }}>
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
                {(lang === 'ar' ? DAY_LABELS_AR : DAY_LABELS).map((label) => (
                  <div key={label} className="text-center text-xs font-semibold py-2" style={{ color: 'var(--text-muted)' }}>
                    {lang === 'ar' ? label.slice(0, 2) : label.slice(0, 2)}
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
                <h3 className="text-base font-bold mb-4" style={{ color: 'var(--text-main)' }}>
                  {t('اختر الوقت', 'Select Time')}
                  <span className="font-normal mr-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {selectedDate.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                </h3>

                {availabilityLoading ? (
                  <div className="flex items-center gap-3 py-4">
                    <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--border-color)', borderTopColor: '#D4A353' }} />
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('جاري تحميل الأوقات...', 'Loading slots...')}</span>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: 'var(--bg-light)' }}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--text-muted)">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {t('لا توجد أوقات متاحة لهذا اليوم', 'No available slots for this day')}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {availableSlots.map((time) => {
                      const isSelectedTime = selectedTime === time;
                      return (
                        <button
                          key={time}
                          onClick={() => { setSelectedTime(time); setErrorMsg(null); }}
                          className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                            isSelectedTime
                              ? 'bg-[#D4A353] text-[#0F3A40] shadow-md font-bold'
                              : 'border hover:border-[#D4A353] hover:text-[#D4A353]'
                          }`}
                          style={
                            !isSelectedTime
                              ? { borderColor: 'var(--border-color)', color: 'var(--text-main)', background: 'var(--bg-light)' }
                              : {}
                          }
                        >
                          {formatTime(time)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="card p-6 animate-slide-up sticky top-6" style={{ background: 'var(--bg-light)' }}>
              <h3 className="text-base font-bold mb-5" style={{ color: 'var(--text-main)' }}>
                {t('ملخص الحجز', 'Booking Summary')}
              </h3>

              <div className="space-y-3.5">
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>{t('المعلم', 'Tutor')}</span>
                  <span className="font-medium" style={{ color: 'var(--text-main)' }}>
                    {tutor.user.firstName} {tutor.user.lastName}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>{t('المدة', 'Duration')}</span>
                  <span className="font-medium" style={{ color: 'var(--text-main)' }}>
                    {duration === 25 ? t('٢٥ دقيقة', '25 min') : t('٥٠ دقيقة', '50 min')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>{t('السعر', 'Rate')}</span>
                  <span className="font-medium" style={{ color: 'var(--text-main)' }}>
                    ${tutor.hourlyRate}/{t('ساعة', 'hr')}
                  </span>
                </div>

                {selectedDate && selectedTime && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>{t('الموعد', 'Time')}</span>
                    <span className="font-medium" style={{ color: 'var(--text-main)' }}>
                      {selectedDate.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {' '}
                      {formatTime(selectedTime)}
                    </span>
                  </div>
                )}

                <hr style={{ borderColor: 'var(--border-color)' }} />

                <div className="flex items-center justify-between">
                  <span className="font-bold" style={{ color: 'var(--text-main)' }}>
                    {t('الإجمالي', 'Total')}
                  </span>
                  <span className="text-xl font-bold" style={{ color: '#D4A353' }}>
                    ${totalCost.toFixed(2)}
                  </span>
                </div>

                <hr style={{ borderColor: 'var(--border-color)' }} />

                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>{t('الرصيد المتاح', 'Your Balance')}</span>
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
                      {t('رصيدك غير كافٍ. يرجى شحن رصيدك للمتابعة.', 'Insufficient balance. Please add credits to continue.')}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() => bookMutation.mutate()}
                disabled={!canBook || bookMutation.isPending}
                className="btn-primary w-full mt-6 py-3.5 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {bookMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-[#0F3A40] border-t-transparent animate-spin" />
                    {t('جاري الحجز...', 'Booking...')}
                  </span>
                ) : (
                  t('احجز الآن', 'Book Now')
                )}
              </button>

              {!selectedDate && (
                <p className="text-xs text-center mt-3" style={{ color: 'var(--text-muted)' }}>
                  {t('اختر تاريخاً ووقتاً للمتابعة', 'Select a date and time to continue')}
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
