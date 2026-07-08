'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import Navbar from '@/components/layout/Navbar';
import { apiClient } from '@/lib/api-client';

function ResetPasswordForm() {
  const { lang } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const t = (ar: string, en: string) => lang === 'ar' ? ar : en;
  const isAr = lang === 'ar';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="text-center">
        <h3 className="text-xl font-bold mb-2 text-red-500">
          {t('رابط غير صالح', 'Invalid Link')}
        </h3>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          {t('رابط استعادة كلمة المرور غير صالح أو منتهي الصلاحية.', 'The password reset link is invalid or has expired.')}
        </p>
        <Link href={isAr ? '/forgot-password' : '/en/forgot-password'} className="btn-primary w-full">
          {t('طلب رابط جديد', 'Request New Link')}
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError(t('كلمات المرور غير متطابقة', 'Passwords do not match'));
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await apiClient.post('/auth/reset-password', { token, newPassword });
      setSuccess(true);
      setTimeout(() => {
        router.push(isAr ? '/login' : '/en/login');
      }, 3000);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || t('حدث خطأ', 'An error occurred'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 text-green-500">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold mb-2 text-green-500">
          {t('تم تغيير كلمة المرور بنجاح!', 'Password Changed Successfully!')}
        </h3>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          {t('سيتم تحويلك إلى صفحة تسجيل الدخول...', 'Redirecting to login page...')}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-100/10 border border-red-500/20 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block text-sm font-semibold">
          {t('كلمة المرور الجديدة', 'New Password')}
        </label>
        <input
          type="password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="input-field"
          placeholder="••••••••"
          minLength={6}
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-semibold">
          {t('تأكيد كلمة المرور', 'Confirm Password')}
        </label>
        <input
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="input-field"
          placeholder="••••••••"
          minLength={6}
        />
      </div>

      <button
        type="submit"
        disabled={loading || !newPassword || !confirmPassword}
        className="btn-primary w-full mt-4"
      >
        {loading ? (
          <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"></span>
        ) : (
          t('تغيير كلمة المرور', 'Change Password')
        )}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => lang === 'ar' ? ar : en;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-main)' }}>
      <Navbar />
      <div className="flex-1 flex items-center justify-center py-20 px-4">
        <div className="w-full max-w-md card p-8 mx-auto mt-16 animate-slide-up">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 gradient-text logo-font">Mr.H Academy</h1>
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              {t('تغيير كلمة المرور', 'Reset Password')}
            </p>
          </div>
          
          <Suspense fallback={<div className="text-center p-4">Loading...</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
