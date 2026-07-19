'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import Navbar from '@/components/layout/Navbar';
import { apiClient } from '@/lib/api-client';

export default function ForgotPasswordPage() {
  const { t, lang } = useLanguage();
  const isAr = lang === 'ar';

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await apiClient.post('/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || t('ط­ط¯ط« ط®ط·ط£', 'An error occurred'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-main)' }}>
      <Navbar />
      <div className="flex-1 flex items-center justify-center py-20 px-4">
        <div className="w-full max-w-md card p-8 mx-auto mt-16 animate-slide-up">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 gradient-text logo-font">Mr.H Academy</h1>
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              {t('ط§ط³طھط¹ط§ط¯ط© ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±', 'Forgot Password')}
            </p>
          </div>

          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 text-green-500">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2 text-green-500">
                {t('طھظ… ط¥ط±ط³ط§ظ„ ط§ظ„ط±ط§ط¨ط·', 'Link Sent!')}
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                {t('ظٹط±ط¬ظ‰ ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† ط¨ط±ظٹط¯ظƒ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ ظ„ظ„ط­طµظˆظ„ ط¹ظ„ظ‰ ط±ط§ط¨ط· ط§ط³طھط¹ط§ط¯ط© ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±.', 'Please check your email for the password reset link.')}
              </p>
              <Link href={isAr ? '/login' : '/en/login'} className="btn-primary w-full">
                {t('ط§ظ„ط¹ظˆط¯ط© ظ„طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„', 'Return to Login')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 text-sm text-red-500 bg-red-100/10 border border-red-500/20 rounded-lg">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold">
                  {t('ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ', 'Email')}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder={t('ط£ط¯ط®ظ„ ط¨ط±ظٹط¯ظƒ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ', 'Enter your email')}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="btn-primary w-full mt-4"
              >
                {loading ? (
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"></span>
                ) : (
                  t('ط¥ط±ط³ط§ظ„ ط±ط§ط¨ط· ط§ظ„ط§ط³طھط¹ط§ط¯ط©', 'Send Reset Link')
                )}
              </button>

              <div className="text-center mt-6">
                <Link href={isAr ? '/login' : '/en/login'} className="link text-sm font-semibold">
                  {t('ط§ظ„ط¹ظˆط¯ط© ظ„طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„', 'Return to Login')}
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

