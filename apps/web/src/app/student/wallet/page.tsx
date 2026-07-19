'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

// Backend PaymentMethod enum values â€” must match exactly
const PAYMENT_METHODS = [
  { key: 'card',     labelAr: 'ط¨ط·ط§ظ‚ط© ط§ط¦طھظ…ط§ظ†',  labelEn: 'Credit Card',    icon: 'ًں’³', requiresReceipt: false },
  { key: 'paypal',   labelAr: 'PayPal',          labelEn: 'PayPal',         icon: 'ًں…؟ï¸ڈ', requiresReceipt: false },
  { key: 'vodafone', labelAr: 'ظپظˆط¯ط§ظپظˆظ† ظƒط§ط´',    labelEn: 'Vodafone Cash',  icon: 'ًں“±', requiresReceipt: true  },
  { key: 'instapay', labelAr: 'ط§ظ†ط³طھط§ط¨ط§ظٹ',        labelEn: 'Instapay',       icon: 'âڑ،', requiresReceipt: true  },
  { key: 'binance',  labelAr: 'ط¨ط§ظٹظ†ظ†ط³',          labelEn: 'Binance',        icon: 'ًںھ™', requiresReceipt: true  },
  { key: 'bank',     labelAr: 'طھط­ظˆظٹظ„ ط¨ظ†ظƒظٹ',     labelEn: 'Bank Transfer',  icon: 'ًںڈ¦', requiresReceipt: true  },
] as const;

type MethodKey = typeof PAYMENT_METHODS[number]['key'];

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

type BalanceData = { balance: number; creditPrice: number; egpRate: number };

const statusConfig: Record<string, { ar: string; en: string; bg: string; color: string }> = {
  approved: { ar: 'ظ…ظ‚ط¨ظˆظ„',       en: 'Approved', bg: 'rgba(34,197,94,0.1)',  color: '#22c55e' },
  pending:  { ar: 'ظ‚ظٹط¯ ط§ظ„ط§ظ†طھط¸ط§ط±', en: 'Pending',  bg: 'rgba(234,179,8,0.1)', color: '#eab308' },
  rejected: { ar: 'ظ…ط±ظپظˆط¶',       en: 'Rejected', bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
};

export default function StudentWalletPage() {
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  // Form state
  const [selectedMethod, setSelectedMethod] = useState<MethodKey>('card');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'EGP'>('USD');
  const [adminNote, setAdminNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const method = PAYMENT_METHODS.find(m => m.key === selectedMethod)!;
  const requiresReceipt = method.requiresReceipt;

  const amountNum = parseFloat(amount) || 0;

  const { data: balance, isLoading: balanceLoading } = useQuery<BalanceData>({
    queryKey: ['wallet-balance'],
    queryFn: async () => {
      const { data } = await apiClient.get<BalanceData>('/students/balance');
      return data;
    },
  });

  const amountInUsd = currency === 'EGP' ? amountNum / (balance?.egpRate ?? 50) : amountNum;

  const { data: paymentHistory = [], isLoading: historyLoading } = useQuery<PaymentRecord[]>({
    queryKey: ['payment-history'],
    queryFn: async () => {
      const { data } = await apiClient.get<PaymentRecord[]>('/payments/history');
      return data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('amount', String(amountNum));
      formData.append('method', selectedMethod);
      formData.append('currency', currency);
      if (adminNote.trim()) formData.append('adminNote', adminNote.trim());
      if (file) formData.append('screenshot', file);
      formData.append('idempotencyKey', crypto.randomUUID());

      const { data } = await apiClient.post<{ checkoutUrl?: string }>('/payments/submit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      queryClient.invalidateQueries({ queryKey: ['payment-history'] });
      queryClient.invalidateQueries({ queryKey: ['student-balance'] });
      setSuccessMsg(
        requiresReceipt
          ? t('طھظ… ط¥ط±ط³ط§ظ„ ط·ظ„ط¨ ط§ظ„ط¯ظپط¹. ط³ظٹطھظ… ظ…ط±ط§ط¬ط¹طھظ‡ ظ…ظ† ظ‚ط¨ظ„ ط§ظ„ط¥ط¯ط§ط±ط©.', 'Payment request submitted. Admin will review it shortly.')
          : t('طھظ… ط¥ط±ط³ط§ظ„ ط·ظ„ط¨ ط§ظ„ط¯ظپط¹ ط¨ظ†ط¬ط§ط­', 'Payment submitted successfully')
      );
      // Reset form
      setAmount('');
      setAdminNote('');
      setFile(null);
      setFilePreview(null);
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (error: { response?: { data?: { message?: string } } } & Error) => {
      const msg = error?.response?.data?.message || error?.message || t('ط­ط¯ط« ط®ط·ط£', 'An error occurred');
      alert(msg);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setFilePreview(null);
    }
  };

  const canSubmit = amountNum >= 5 && (!requiresReceipt || file !== null);
  const credits = amountInUsd > 0 && (balance?.creditPrice ?? 15) > 0
    ? (amountInUsd / (balance?.creditPrice ?? 15)).toFixed(2)
    : '0.00';

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>
          {t('ط§ظ„ظ…ط­ظپط¸ط©', 'Wallet')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {t('ط§ط´ط­ظ† ط±طµظٹط¯ظƒ ظ„ط­ط¬ط² ط§ظ„ط¯ط±ظˆط³', 'Top up your balance to book lessons')}
        </p>
      </div>

      {/* Balance card */}
      <div className="card-gold p-6 text-center">
        {balanceLoading ? (
          <div className="h-12 w-32 skeleton rounded mx-auto" />
        ) : (
          <>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('ط§ظ„ط±طµظٹط¯ ط§ظ„ط­ط§ظ„ظٹ', 'Current Balance')}</p>
            <p className="text-4xl font-bold mt-1" style={{ color: '#D4A353' }}>
              ${Number(balance?.balance ?? 0).toFixed(2)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              1 {t('ط§ط¦طھظ…ط§ظ†', 'credit')} = ${balance?.creditPrice ?? 15}
            </p>
          </>
        )}
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="#22c55e"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#22c55e' }}>{successMsg}</p>
            {requiresReceipt && (
              <p className="text-xs mt-1" style={{ color: '#22c55e' }}>
                {t('ط³طھط±ظ‰ طھط­ط¯ظٹط« ط§ظ„ط±طµظٹط¯ ط¨ط¹ط¯ ظ…ظˆط§ظپظ‚ط© ط§ظ„ط¥ط¯ط§ط±ط©.', 'Your balance will update once admin approves.')}
              </p>
            )}
          </div>
          <button onClick={() => setSuccessMsg('')} className="ms-auto opacity-60 hover:opacity-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#22c55e"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Payment form */}
      <div className="card p-6 space-y-5">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{t('ط§ط´ط­ظ† ط±طµظٹط¯ظƒ', 'Top Up Balance')}</h2>

        {/* Method selector */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-main)' }}>{t('ط·ط±ظٹظ‚ط© ط§ظ„ط¯ظپط¹', 'Payment Method')}</label>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm.key}
                type="button"
                onClick={() => { setSelectedMethod(pm.key); setSuccessMsg(''); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: selectedMethod === pm.key ? 'rgba(212,163,83,0.15)' : 'var(--bg-light)',
                  border: selectedMethod === pm.key ? '2px solid #D4A353' : '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                }}
              >
                <span>{pm.icon}</span>
                {lang === 'ar' ? pm.labelAr : pm.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* Amount + currency */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('ط§ظ„ظ…ط¨ظ„ط؛', 'Amount')}</label>
            <input
              type="number"
              min="5"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-field w-full"
              placeholder="0.00"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('ط§ظ„ط­ط¯ ط§ظ„ط£ط¯ظ†ظ‰ 5', 'Minimum 5')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('ط§ظ„ط¹ظ…ظ„ط©', 'Currency')}</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as 'USD' | 'EGP')}
              className="input-field w-full"
            >
              <option value="USD">USD $</option>
              <option value="EGP">EGP ط¬.ظ…</option>
            </select>
          </div>
        </div>

        {/* Credits preview */}
        {amountNum > 0 && (
          <p className="text-sm font-medium" style={{ color: '#D4A353' }}>
            â‰ˆ {credits} {t('ط±طµظٹط¯ طھط¹ظ„ظٹظ…ظٹ', 'credits')}
            {currency === 'EGP' && (
              <span className="text-xs ms-2" style={{ color: 'var(--text-muted)' }}>
                {t('(1 USD = 50 EGP)', '(1 USD = 50 EGP)')}
              </span>
            )}
          </p>
        )}

        {/* Receipt upload for manual methods */}
        {requiresReceipt && (
          <div className="p-4 rounded-xl" style={{ background: 'var(--bg-light)', border: '1px solid var(--border-color)' }}>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-main)' }}>
              {t('طµظˆط±ط© ط§ظ„ط¥ظٹطµط§ظ„ / ط§ظ„طھط­ظˆظٹظ„', 'Payment Receipt / Transfer Screenshot')}
              <span className="text-xs ms-1" style={{ color: '#ef4444' }}>*</span>
            </label>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              {t('ط£ط±ظپظ‚ طµظˆط±ط© ط¥ط«ط¨ط§طھ ط§ظ„ط¯ظپط¹. ط³ظٹطھظ… ظ…ط±ط§ط¬ط¹طھظ‡ط§ ظ…ظ† ظ‚ط¨ظ„ ط§ظ„ط¥ط¯ط§ط±ط© ظ„طھظپط¹ظٹظ„ ط§ظ„ط±طµظٹط¯.', 'Attach proof of payment. Admin will review it to activate your balance.')}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileChange}
              className="text-sm w-full"
              style={{ color: 'var(--text-main)' }}
            />
            {filePreview && (
              <div className="mt-3 relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={filePreview} alt="receipt preview" className="max-h-32 rounded-lg border" style={{ borderColor: 'var(--border-color)' }} />
                <button
                  type="button"
                  onClick={() => { setFile(null); setFilePreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs"
                  style={{ background: '#ef4444' }}
                >أ—</button>
              </div>
            )}
            {file && !filePreview && (
              <p className="text-xs mt-2" style={{ color: '#22c55e' }}>
                âœ“ {file.name}
              </p>
            )}
          </div>
        )}

        {/* Admin note */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
            {t('ظ…ظ„ط§ط­ط¸ط© ظ„ظ„ط¥ط¯ط§ط±ط© (ط§ط®طھظٹط§ط±ظٹ)', 'Note for admin (optional)')}
          </label>
          <input
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            className="input-field w-full"
            placeholder={t('ظ…ط«ظ„: ط¯ظپط¹طھ ط¹ط¨ط± ظپظˆط¯ط§ظپظˆظ† ط¹ظ„ظ‰ ط§ظ„ط±ظ‚ظ… 01000000000', 'e.g. Paid via Vodafone to 01000000000')}
          />
        </div>

        <button
          type="button"
          onClick={() => submitMutation.mutate()}
          disabled={!canSubmit || submitMutation.isPending}
          className="btn-primary w-full py-3 disabled:opacity-50"
        >
          {submitMutation.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t('ط¬ط§ط±ظٹ ط§ظ„ط¥ط±ط³ط§ظ„...', 'Submitting...')}
            </span>
          ) : requiresReceipt
            ? t('ط¥ط±ط³ط§ظ„ ط·ظ„ط¨ ط§ظ„ط¯ظپط¹', 'Submit Payment Request')
            : t('ظ…طھط§ط¨ط¹ط© ط§ظ„ط¯ظپط¹', 'Proceed to Payment')}
        </button>

        {requiresReceipt && (
          <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'rgba(212,163,83,0.08)', border: '1px solid rgba(212,163,83,0.2)' }}>
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="#D4A353"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t(
                'ط¨ط¹ط¯ ط§ظ„ط¥ط±ط³ط§ظ„طŒ ط³طھظ†طھط¸ط± ظ…ظˆط§ظپظ‚ط© ط§ظ„ط¥ط¯ط§ط±ط© ط¹ظ„ظ‰ ط§ظ„ط¯ظپط¹. ظٹطھظ… ظ…ط±ط§ط¬ط¹ط© ط§ظ„ط·ظ„ط¨ط§طھ ط®ظ„ط§ظ„ 24 ط³ط§ط¹ط© ط¹ط§ط¯ط©ظ‹.',
                'After submitting, you will wait for admin approval. Requests are usually reviewed within 24 hours.'
              )}
            </p>
          </div>
        )}
      </div>

      {/* Payment history */}
      <div>
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-main)' }}>
          {t('ط³ط¬ظ„ ط§ظ„ظ…ط¯ظپظˆط¹ط§طھ', 'Payment History')}
        </h2>

        {historyLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-5">
                <div className="h-4 w-40 skeleton rounded mb-2" />
                <div className="h-3 w-24 skeleton rounded" />
              </div>
            ))}
          </div>
        ) : paymentHistory.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(212,163,83,0.1)' }}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#D4A353"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m0 0v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5m18 0v9a2.25 2.25 0 01-2.25 2.25h-.75m-13.5-7.5h3.75m-3.75 3h3.75m-3.75 3h3.75" /></svg>
            </div>
            <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>{t('ظ„ط§ طھظˆط¬ط¯ ظ…ط¯ظپظˆط¹ط§طھ ط¨ط¹ط¯', 'No payments yet')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {paymentHistory.map((payment) => {
              const cfg = statusConfig[payment.status] ?? statusConfig.pending;
              return (
                <div key={payment.id} className="card p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${cfg.color}15` }}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={cfg.color} strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-main)' }}>
                          {payment.amount.toFixed(2)} {payment.currency}
                        </p>
                        <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          <span>{payment.method}</span>
                          <span>آ·</span>
                          <span>{new Date(payment.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>
                    <span className="badge text-xs font-semibold shrink-0" style={{ background: cfg.bg, color: cfg.color }}>
                      {lang === 'ar' ? cfg.ar : cfg.en}
                    </span>
                  </div>

                  {payment.status === 'rejected' && payment.rejectionReason && (
                    <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444' }}>
                      <span className="font-semibold">{t('ط³ط¨ط¨ ط§ظ„ط±ظپط¶: ', 'Rejected: ')}</span>
                      {payment.rejectionReason}
                    </div>
                  )}

                  {payment.status === 'pending' && (
                    <p className="text-xs mt-2" style={{ color: '#eab308' }}>
                      {t('âڈ³ ظ‚ظٹط¯ ط§ظ„ظ…ط±ط§ط¬ط¹ط© ظ…ظ† ظ‚ط¨ظ„ ط§ظ„ط¥ط¯ط§ط±ط©', 'âڈ³ Pending admin review')}
                    </p>
                  )}

                  {payment.receiptUrl && (
                    <a
                      href={payment.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs px-2 py-1 rounded-lg"
                      style={{ background: 'rgba(212,163,83,0.1)', color: '#D4A353' }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {t('ط¹ط±ط¶ ط§ظ„ط¥ظٹطµط§ظ„', 'View Receipt')}
                    </a>
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

