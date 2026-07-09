'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';
import { useAuth } from '@/contexts/auth-context';
import Image from 'next/image';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type CourseDetail = {
  id: string;
  title: string;
  description: string;
  price: number;
  thumbnailUrl?: string;
  bunnyVideoId?: string | null;
  tutor: { firstName: string; lastName: string; avatarUrl?: string };
};

type CourseLesson = {
  id: string;
  title: string;
  durationMinutes: number;
  lessonOrder: number;
  isCompleted?: boolean;
};

export default function CourseDetailPage() {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const referralStorageKey = `course_ref_${params.id}`;
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamError, setStreamError] = useState('');
  const { data: course, isLoading } = useQuery({
    queryKey: ['course', params.id],
    queryFn: async () => {
      const { data } = await apiClient.get<CourseDetail>(`/courses/${params.id}`);
      return data;
    },
  });

  const { data: enrollments } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: async () => {
      const { data } = await apiClient.get<Array<{ courseId: string; progressPercentage: number }>>('/courses/my/enrollments');
      return data;
    },
    enabled: !!user && user.role === 'student',
  });

  const enrollment = enrollments?.find((e) => e.courseId === params.id);

  const { data: lessons } = useQuery({
    queryKey: ['course-lessons', params.id],
    queryFn: async () => {
      const { data } = await apiClient.get<CourseLesson[]>(`/courses/${params.id}/lessons`);
      return data;
    },
    enabled: !!user && !!enrollment,
  });

  const completeMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      const { data } = await apiClient.post(`/courses/${params.id}/lessons/${lessonId}/complete`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-lessons', params.id] });
      queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
    },
  });

  const watchVideo = async () => {
    setStreamError('');
    try {
      const { data } = await apiClient.get<{ token: string }>(`/courses/${params.id}/stream-token`);
      setStreamUrl(data.token);
    } catch {
      setStreamError(
        lang === 'ar'
          ? 'الفيديو غير متاح. تأكد من إعداد Bunny CDN على الخادم (BUNNY_API_KEY, BUNNY_CDN_HOSTNAME).'
          : 'Video unavailable. Ensure Bunny CDN is configured on the API (BUNNY_API_KEY, BUNNY_CDN_HOSTNAME).',
      );
    }
  };

  const getCookie = (name: string) => {
    if (typeof window === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return match ? decodeURIComponent(match[2]) : null;
  };

  const enrollMutation = useMutation({
    mutationFn: async () => {
      const referralCode = getCookie(referralStorageKey);
      const { data } = await apiClient.post(`/courses/${params.id}/enroll`, {
        referralCode: referralCode || undefined,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['course-lessons', params.id] });
      router.push('/student?tab=lessons');
    },
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(referralStorageKey);
    }
    const ref = searchParams.get('ref');
    if (ref) {
      const d = new Date();
      d.setTime(d.getTime() + 30 * 24 * 60 * 60 * 1000);
      document.cookie = `${referralStorageKey}=${ref};expires=${d.toUTCString()};path=/`;
    }
  }, [referralStorageKey, searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-12">
          <div className="card p-8 space-y-6">
            <div className="h-8 skeleton rounded w-2/3" />
            <div className="h-4 skeleton rounded w-full" />
            <div className="h-4 skeleton rounded w-3/4" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-12 text-center">
          <p className="text-lg" style={{ color: 'var(--text-muted)' }}>
            {lang === 'ar' ? 'الكورس غير موجود' : 'Course not found'}
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl overflow-hidden h-64 relative flex items-center justify-center" style={{ background: 'var(--bg-light)' }}>
              {course.thumbnailUrl ? (
                <Image src={course.thumbnailUrl} alt={course.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
              ) : (
                <div className="w-24 h-24 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(212, 163, 83,0.15)' }}>
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="#D4A353">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
              )}
            </div>

            <h1 className="text-3xl font-bold" style={{ color: 'var(--text-main)' }}>{course.title}</h1>
            <p className="leading-relaxed" style={{ color: 'var(--text-muted)' }}>{course.description}</p>

            {enrollment && (
              <div className="card p-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>
                      {lang === 'ar' ? 'تقدمك في الكورس' : 'Your Progress'}
                    </span>
                    <span className="text-sm font-bold" style={{ color: '#D4A353' }}>
                      {enrollment.progressPercentage}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-light)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${enrollment.progressPercentage}%`, background: '#D4A353' }}
                    />
                  </div>
                </div>
                <button type="button" onClick={watchVideo} className="btn-outline-gold w-full text-sm">
                  {lang === 'ar' ? 'مشاهدة فيديو الكورس' : 'Watch Course Video'}
                </button>
                {streamUrl && (
                  <video src={streamUrl} controls className="w-full rounded-lg" />
                )}
                {streamError && (
                  <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>{streamError}</p>
                )}
              </div>
            )}

            {lessons && lessons.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>
                  {lang === 'ar' ? 'محتوى الكورس' : 'Course Content'}
                </h2>
                <div className="space-y-2">
                  {lessons.map((lesson) => (
                    <div key={lesson.id} className="card p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: lesson.isCompleted ? 'rgba(34,197,94,0.15)' : 'rgba(212, 163, 83,0.15)', color: lesson.isCompleted ? '#22c55e' : '#D4A353' }}>
                          {lesson.isCompleted ? '✓' : lesson.lessonOrder}
                        </span>
                        <div>
                          <p className="font-medium text-sm" style={{ color: 'var(--text-main)' }}>{lesson.title}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{lesson.durationMinutes} {lang === 'ar' ? 'دقيقة' : 'min'}</p>
                        </div>
                      </div>
                      {enrollment && !lesson.isCompleted && (
                        <button
                          type="button"
                          onClick={() => completeMutation.mutate(lesson.id)}
                          disabled={completeMutation.isPending}
                          className="btn-primary text-xs px-3 py-1.5 shrink-0"
                        >
                          {lang === 'ar' ? 'إكمال' : 'Complete'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="card p-6 sticky top-24">
              <p className="text-3xl font-bold mb-1" style={{ color: '#D4A353' }}>${course.price.toFixed(2)}</p>
              <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ar' ? 'سعر الكورس' : 'Course price'}
              </p>

              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                <span className="font-medium" style={{ color: 'var(--text-main)' }}>{course.tutor.firstName} {course.tutor.lastName}</span>
              </p>

              {user?.role === 'student' ? (
                enrollment ? (
                  <p className="text-sm text-center py-3" style={{ color: '#22c55e' }}>
                    {lang === 'ar' ? 'أنت مسجل في هذا الكورس' : 'You are enrolled in this course'}
                  </p>
                ) : (
                  <button
                    onClick={() => enrollMutation.mutate()}
                    disabled={enrollMutation.isPending}
                    className="btn-primary w-full"
                  >
                    {enrollMutation.isPending
                      ? (lang === 'ar' ? 'جاري التسجيل...' : 'Enrolling...')
                      : (lang === 'ar' ? 'سجل الآن' : 'Enroll Now')}
                  </button>
                )
              ) : user ? (
                <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                  {lang === 'ar' ? 'التسجيل متاح للطلاب فقط' : 'Enrollment is for students only'}
                </p>
              ) : (
                <Link href="/login" className="btn-primary w-full block text-center">
                  {lang === 'ar' ? 'سجل الدخول للتسجيل' : 'Login to Enroll'}
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
