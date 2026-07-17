'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';
import Link from 'next/link';

type TutorProfile = {
  balance: number;
  stripeAccountId?: string;
  stripeOnboardingComplete?: boolean;
};

type Payout = {
  id: string;
  amount: number;
  method: string;
  accountDetails: string;
  status: string;
  adminNote?: string;
  errorMessage?: string;
  createdAt: string;
};

const PAYOUT_METHODS = [
  { key: 'bank_transfer', labelAr: 'تحويل بنكي', labelEn: 'Bank Transfer' },
  { key: 'paypal',        labelAr: 'PayPal',       labelEn: 'PayPal' },
  { key: 'vodafone_cash', labelAr: 'فودافون كاش',  labelEn: 'Vodafone Cash' },
  { key: 'instapay',      labelAr: 'انستاباي',     labelEn: 'Instapay' },
] as const;

type PayoutMethod = typeof PAYOUT_METHODS[number]['key'];

const statusConfig: Record<string, { ar: string; en: string; bg: string; color: string }> = {
  pending: { ar: 'قيد الانتظار', en: 'Pending',  bg: 'rgba(234,179,8,0.1)',  color: '#eab308' },
  success: { ar: 'مكتمل',        en: 'Completed', bg: 'rgba(34,197,94,0.1)', color: '#22c55e' },
  failed:  { ar: 'فشل',          en: 'Failed',    bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
};

export default function TutorEarningsPage() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const t = (ar: string, en: string) => lang === 'ar' ? ar : en;

  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PayoutMethod>('bank_transfer');
  const [accountDetails, setAccountDetails] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const profileQuery = useQuery<TutorProfile>({
    queryKey: ['tutor-profile-balance'],
    queryFn: async () => {
      const { data } = await apiClient.get<TutorProfile>('/tutors/me/profile');
      return data;
    },
  });

  const payoutsQuery = useQuery<Payout[]>({
    queryKey: ['my-payouts'],
    queryFn: async () => {
      const { data } = await apiClient.get<Payout[]>('/payouts/my');
      return data;
    },
  });

  const requestPayoutMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/payouts', {
        amount: parseFloat(amount),
        method,
        accountDetails,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['tutor-profile-balance'] });
      setSuccessMsg(t('تم إرسال طلب السحب. سيتم مراجعته من قبل الإدارة.', 'Payout request submitted. Admin will review it.'));
      setAmount('');
      setAccountDetails('');
      setShowPayoutForm(false);
    },
    onError: (error: { response?: { data?: { message?: string } } } & Error) => {
      const msg = error?.response?.data?.message || error?.message || t('حدث خطأ', 'An error occurred');
      alert(msg);
    },
  });

  const balance = profileQuery.data?.balance ?? 0;
  const amountNum = parseFloat(amount) || 0;
  const canSubmit = amountNum >= 10 && amountNum <= balance && accountDetails.trim().length > 3;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-8">
      {/* Back link */}
      <Link href="/tutor" className="inline-flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        {t('العودة للوحة التحكم', 'Back to Dashboard')}
      </Link>

      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>
          {t('الأرباح والسحب', 'Earnings & Payouts')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {t('تتراكم أرباحك بعد اكتمال كل درس', 'Your earnings accumulate after each completed lesson')}
        </p>
      </div>

      {/* Balance card */}
      <div className="card-gold p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('الرصيد المتاح', 'Available Balance')}</p>
            {profileQuery.isLoading ? (
              <div className="h-10 w-28 skeleton rounded mt-1" />
            ) : (
              <p className="text-4xl font-bold mt-1" style={{ color: '#D4A353' }}>
                ${balance.toFixed(2)}
              </p>
            )}
          </div>
          {balance >= 10 && (
            <button
              onClick={() => setShowPayoutForm(!showPayoutForm)}
              className="btn-primary px-5 py-2.5"
            >
              {showPayoutForm ? t('إلغاء', 'Cancel') : t('طلب سحب', 'Request Payout')}
            </button>
          )}
        </div>
        {balance < 10 && balance > 0 && (
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            {t('الحد الأدنى للسحب هو $10', 'Minimum payout amount is $10')}
          </p>
        )}
        {balance === 0 && !profileQuery.isLoading && (
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            {t('لا يوجد رصيد للسحب حالياً. أكمل دروساً لكسب الأرباح.', 'No balance to withdraw. Complete lessons to earn.')}
          </p>
        )}
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="#22c55e"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          <p className="text-sm font-semibold" style={{ color: '#22c55e' }}>{successMsg}</p>
          <button onClick={() => setSuccessMsg('')} className="ms-auto opacity-60 hover:opacity-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#22c55e"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Payout request form */}
      {showPayoutForm && (
        <div className="card p-6 space-y-4">
          <h2 className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
            {t('طلب سحب أرباح', 'Request Payout')}
          </h2>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
              {t('المبلغ (USD)', 'Amount (USD)')}
            </label>
            <input
              type="number"
              min="10"
              max={balance}
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="input-field w-full"
              placeholder="0.00"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {t(`الرصيد المتاح: $${balance.toFixed(2)} · الحد الأدنى: $10`, `Available: $${balance.toFixed(2)} · Minimum: $10`)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-main)' }}>
              {t('طريقة الدفع', 'Payout Method')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PAYOUT_METHODS.map(pm => (
                <label
                  key={pm.key}
                  className="flex items-center gap-2 p-3 rounded-lg cursor-pointer border transition-all"
                  style={{
                    border: method === pm.key ? '2px solid #D4A353' : '1px solid var(--border-color)',
                    background: method === pm.key ? 'rgba(212,163,83,0.1)' : 'var(--bg-light)',
                  }}
                >
                  <input
                    type="radio"
                    name="payout-method"
                    value={pm.key}
                    checked={method === pm.key}
                    onChange={() => setMethod(pm.key)}
                    className="hidden"
                  />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>
                    {lang === 'ar' ? pm.labelAr : pm.labelEn}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
              {t('تفاصيل الحساب', 'Account Details')}
            </label>
            <input
              value={accountDetails}
              onChange={e => setAccountDetails(e.target.value)}
              className="input-field w-full"
              placeholder={
                method === 'bank_transfer'
                  ? t('رقم الحساب / IBAN', 'Account number / IBAN')
                  : method === 'paypal'
                    ? 'PayPal email'
                    : method === 'vodafone_cash'
                      ? t('رقم الهاتف', 'Phone number')
                      : t('رقم الهاتف / معرف الحساب', 'Phone / Account ID')
              }
            />
          </div>

          <button
            type="button"
            onClick={() => requestPayoutMutation.mutate()}
            disabled={!canSubmit || requestPayoutMutation.isPending}
            className="btn-primary w-full py-3 disabled:opacity-50"
          >
            {requestPayoutMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('جاري الإرسال...', 'Submitting...')}
              </span>
            ) : t('إرسال طلب السحب', 'Submit Payout Request')}
          </button>
        </div>
      )}

      {/* Payout history */}
      <div>
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-main)' }}>
          {t('سجل السحوبات', 'Payout History')}
        </h2>

        {payoutsQuery.isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="card p-4">
                <div className="h-4 w-32 skeleton rounded mb-2" />
                <div className="h-3 w-20 skeleton rounded" />
              </div>
            ))}
          </div>
        ) : (payoutsQuery.data ?? []).length === 0 ? (
          <div className="card p-10 text-center">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(212,163,83,0.1)' }}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#D4A353">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>
              {t('لا توجد سحوبات بعد', 'No payouts yet')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(payoutsQuery.data ?? []).map(payout => {
              const cfg = statusConfig[payout.status] ?? statusConfig.pending;
              return (
                <div key={payout.id} className="card p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${cfg.color}15` }}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={cfg.color} strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-main)' }}>
                          ${payout.amount.toFixed(2)}
                        </p>
                        <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          <span>{payout.method}</span>
                          <span>·</span>
                          <span>{payout.accountDetails}</span>
                          <span>·</span>
                          <span>{new Date(payout.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>
                    <span className="badge text-xs font-semibold shrink-0" style={{ background: cfg.bg, color: cfg.color }}>
                      {lang === 'ar' ? cfg.ar : cfg.en}
                    </span>
                  </div>
                  {payout.status === 'failed' && payout.errorMessage && (
                    <p className="text-xs mt-2 px-1" style={{ color: '#ef4444' }}>
                      {payout.errorMessage}
                    </p>
                  )}
                  {payout.adminNote && payout.status !== 'failed' && (
                    <p className="text-xs mt-2 px-1" style={{ color: 'var(--text-muted)' }}>
                      {payout.adminNote}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
