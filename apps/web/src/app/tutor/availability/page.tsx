'use client';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

type Slot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
};

function getErrorMessage(error: unknown, fallback: string) {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function AvailabilityPage() {
  const searchParams = useSearchParams();
  const { dir } = useLanguage();
  const isAr = dir === 'rtl';
  const queryClient = useQueryClient();
  const [isRecurring, setIsRecurring] = useState(true);
  const [painting, setPainting] = useState<'add' | 'remove' | null>(null);
  const [timeOffStart, setTimeOffStart] = useState('');
  const [timeOffEnd, setTimeOffEnd] = useState('');
  const [timeOffSaved, setTimeOffSaved] = useState(false);

  const saveTimeOff = () => {
    if (!timeOffStart || !timeOffEnd || timeOffEnd < timeOffStart) return;
    localStorage.setItem('tutor_time_off', JSON.stringify({ start: timeOffStart, end: timeOffEnd }));
    setTimeOffSaved(true);
  };

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['tutor-availability'],
    queryFn: async () => {
      const { data } = await apiClient.get<Slot[]>('/tutor/availability');
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (slotData: { dayOfWeek: number; startTime: string; endTime: string; isRecurring: boolean }) => {
      const { data } = await apiClient.post<Slot>('/tutor/availability', slotData);
      return data;
    },
    onSuccess: (newSlot) => {
      queryClient.setQueryData<Slot[]>(['tutor-availability'], (prev) => prev ? [...prev, newSlot] : [newSlot]);
    },
    onError: (error) => {
      alert(getErrorMessage(error, 'Failed to add slot'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (slotId: string) => {
      await apiClient.delete(`/tutor/availability/${slotId}`);
      return slotId;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<Slot[]>(['tutor-availability'], (prev) => prev?.filter((s) => s.id !== deletedId));
    },
  });

  const slotAt = useCallback((dayIndex: number, hour: number): Slot | undefined => {
    const time = `${String(hour).padStart(2, '0')}:00`;
    return slots.find((s) => s.dayOfWeek === dayIndex && s.startTime.slice(0, 2) === time.slice(0, 2));
  }, [slots]);

  const toggleSlot = useCallback(async (dayIndex: number, hour: number) => {
    const existing = slotAt(dayIndex, hour);
    if (existing) {
      deleteMutation.mutate(existing.id);
    } else {
      const endHour = hour + 1;
      const endTime = `${String(endHour).padStart(2, '0')}:00`;
      const startTime = `${String(hour).padStart(2, '0')}:00`;
      addMutation.mutate({ dayOfWeek: dayIndex, startTime, endTime, isRecurring });
    }
  }, [slotAt, isRecurring, addMutation, deleteMutation]);

  const handleMouseDown = (dayIndex: number, hour: number) => {
    const existing = slotAt(dayIndex, hour);
    setPainting(existing ? 'remove' : 'add');
    toggleSlot(dayIndex, hour);
  };

  const handleMouseEnter = (dayIndex: number, hour: number) => {
    if (!painting) return;
    const existing = slotAt(dayIndex, hour);
    if (painting === 'add' && !existing) toggleSlot(dayIndex, hour);
    else if (painting === 'remove' && existing) toggleSlot(dayIndex, hour);
  };

  const handleMouseUp = () => setPainting(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <svg className="w-8 h-8 text-indigo-500 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }} onMouseUp={handleMouseUp}>
      <div className="border-b" style={{ background: 'var(--bg-light)', borderColor: 'var(--border-color)' }}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: 'var(--text-main)' }}>{isAr ? 'أوقات التوفر' : 'My Availability'}</h1>
              <p className="mt-1" style={{ color: 'var(--text-muted)' }}>{isAr ? 'اسحب على الجدول لتحديد ساعات التدريس المتاحة' : 'Click and drag across the grid to set your teaching hours'}</p>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <div className={`w-10 h-5 rounded-full transition-colors relative ${isRecurring ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                  <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="sr-only" />
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isRecurring ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm font-medium text-slate-700">Weekly recurring</span>
              </label>
              <Link href="/tutor" className="btn-secondary px-4 py-2 text-sm">Dashboard</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {searchParams.get('mode') === 'timeoff' && (
          <section className="card mb-6 p-5 border" style={{ borderColor: 'var(--primary-color)' }}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{isAr ? 'خطة الإجازة' : 'Plan time off'}</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{isAr ? 'احفظ فترة لن تظهر فيها مواعيد جديدة للطلاب.' : 'Save a break so you can keep your teaching calendar clear.'}</p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{isAr ? 'من' : 'From'}<input type="date" value={timeOffStart} onChange={(e) => setTimeOffStart(e.target.value)} className="input-field mt-1 block" /></label>
                <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{isAr ? 'إلى' : 'To'}<input type="date" value={timeOffEnd} onChange={(e) => setTimeOffEnd(e.target.value)} className="input-field mt-1 block" /></label>
                <button type="button" onClick={saveTimeOff} className="btn-primary px-4 py-2">{isAr ? 'حفظ الإجازة' : 'Save time off'}</button>
              </div>
            </div>
            {timeOffSaved && <p className="text-xs mt-3" style={{ color: '#22c55e' }}>{isAr ? 'تم حفظ فترة الإجازة.' : 'Time off saved.'}</p>}
          </section>
        )}

        <div className="card overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
          <div className="overflow-x-auto">
            <div className="grid min-w-[800px]" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
              <div className="sticky left-0 bg-white z-10" />
              {DAYS.map((day) => (
                <div key={day} className="text-center font-semibold text-sm py-3 border-b" style={{ background: 'var(--bg-light)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  {day.slice(0, 3)}
                </div>
              ))}
              {HOURS.map((hour, hourIndex) => (
                <div key={hour} className="contents">
                  <div className="text-xs pe-2 text-end py-1.5 border-b self-start sticky start-0 font-mono" style={{ background: 'var(--bg-light)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                    {hour}
                  </div>
                  {DAYS.map((_, dayIndex) => {
                    const filled = slotAt(dayIndex, hourIndex);
                    return (
                      <div
                        key={`${dayIndex}-${hourIndex}`}
                        onMouseDown={() => handleMouseDown(dayIndex, hourIndex)}
                        onMouseEnter={() => handleMouseEnter(dayIndex, hourIndex)}
                        className={`border-b border-l cursor-pointer transition-all duration-100 min-h-[32px] ${
                          filled
                            ? 'bg-gradient-to-r from-indigo-500 to-indigo-400 hover:from-indigo-600 hover:to-indigo-500'
                            : 'hover:bg-indigo-50'
                        }`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 mt-6 justify-center">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gradient-to-r from-indigo-500 to-indigo-400" />
            <span className="text-sm text-slate-500">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-slate-100 border border-slate-200" />
            <span className="text-sm text-slate-500">Unavailable</span>
          </div>
        </div>
      </div>
    </div>
  );
}
