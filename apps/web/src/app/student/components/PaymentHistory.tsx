'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

type PaymentRecord = {
  id: string;
  amount: number;
  method: string;
  currency: string;
  status: string;
  receiptUrl?: string;
  adminNote?: string;
  rejectionReason?: string;
  createdAt: string;
};

const statusConfig: Record<string, { labelAr: string; labelEn: string; bg: string; color: string }> = {
  approved: { labelAr: 'ظ…ظ‚ط¨ظˆظ„', labelEn: 'Approved', bg: 'rgba(34,197,94,0.1)', color: '#22c55e' },
  pending: { labelAr: 'ظ‚ظٹط¯ ط§ظ„ط§ظ†طھط¸ط§ط±', labelEn: 'Pending', bg: 'rgba(234,179,8,0.1)', color: '#eab308' },
  rejected: { labelAr: 'ظ…ط±ظپظˆط¶', labelEn: 'Rejected', bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
};

export default function PaymentHistory() {
  const { t, lang } = useLanguage();
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payment-history'],
    queryFn: async () => {
      const { data } = await apiClient.get<PaymentRecord[]>('/payments/history');
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-5">
            <div className="h-4 w-40 skeleton" />
            <div className="h-3 w-24 skeleton mt-2" />
          </div>
        ))}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(212, 163, 83,0.1)' }}>
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#D4A353">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>{t('ظ„ط§ طھظˆط¬ط¯ ظ…ط¯ظپظˆط¹ط§طھ', 'No payment history')}</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('ظ‚ظ… ط¨ط¹ظ…ظ„ظٹط© ط§ط´طھط±ط§ظƒ ظ„ط¨ط¯ط، ط§ظ„طھط¹ظ„ظ…', 'Subscribe to start learning')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {payments.map((payment) => {
        const cfg = statusConfig[payment.status] ?? statusConfig.pending;
        const isRejected = payment.status === 'rejected';
        return (
          <div key={payment.id} className="card p-5 hover:translate-y-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${cfg.color}15` }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={cfg.color} strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-main)' }}>
                    {payment.amount.toFixed(2)} {payment.currency}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>{new Date(payment.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span>آ·</span>
                    <span className="badge text-[10px]" style={{ background: 'rgba(212, 163, 83,0.1)', color: '#D4A353' }}>{payment.method}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="badge text-xs font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
                  {lang === 'ar' ? cfg.labelAr : cfg.labelEn}
                </span>
              </div>
            </div>
            {isRejected && payment.rejectionReason && (
              <div className="mt-3 p-3 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <p className="font-semibold" style={{ color: '#ef4444' }}>
                  {t('ط³ط¨ط¨ ط§ظ„ط±ظپط¶:', 'Rejection reason:')}
                </p>
                <p className="mt-1" style={{ color: 'var(--text-muted)' }}>{payment.rejectionReason}</p>
              </div>
            )}
            {payment.receiptUrl && (
              <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs px-2 py-1 rounded-lg transition-colors"
                style={{ background: 'rgba(212, 163, 83,0.1)', color: '#D4A353' }}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {t('ط¹ط±ط¶ ط§ظ„ط¥ظٹطµط§ظ„', 'View Receipt')}
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
