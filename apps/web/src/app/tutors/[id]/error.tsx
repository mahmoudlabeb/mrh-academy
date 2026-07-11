"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function TutorProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Tutor profile error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-main)' }}>
      <div className="card max-w-md w-full p-8 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(212, 163, 83, 0.1)' }}>
          <svg className="w-8 h-8" style={{ color: '#D4A353' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>
          تعذر تحميل الملف الشخصي
        </h1>
        <p className="mb-6" style={{ color: 'var(--text-muted)' }}>
          حدث خطأ أثناء محاولة تحميل بيانات المعلم. يرجى المحاولة مرة أخرى.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="btn-primary px-6 py-3"
          >
            إعادة المحاولة
          </button>
          <Link
            href="/student/discover"
            className="btn-secondary px-6 py-3"
          >
            العودة للمعلمين
          </Link>
        </div>
      </div>
    </div>
  );
}