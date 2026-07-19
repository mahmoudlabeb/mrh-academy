'use client';

import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

interface PaymentModalProps {
  onClose: () => void;
  currentBalance: string;
  creditPrice?: number;
}

// Backend PaymentMethod enum values â€” must match exactly
const PAYMENT_METHODS = [
  { key: 'card',     labelAr: 'ط¨ط·ط§ظ‚ط© ط§ط¦طھظ…ط§ظ†', labelEn: 'Credit Card',   icon: 'ًں’³', requiresReceipt: false },
  { key: 'paypal',   labelAr: 'PayPal',          labelEn: 'PayPal',        icon: 'ًں…؟ï¸ڈ', requiresReceipt: false },
  { key: 'vodafone', labelAr: 'ظپظˆط¯ط§ظپظˆظ† ظƒط§ط´',   labelEn: 'Vodafone Cash', icon: 'ًں“±', requiresReceipt: true  },
  { key: 'instapay', labelAr: 'ط§ظ†ط³طھط§ط¨ط§ظٹ',       labelEn: 'Instapay',      icon: 'âڑ،', requiresReceipt: true  },
  { key: 'binance',  labelAr: 'ط¨ط§ظٹظ†ظ†ط³',         labelEn: 'Binance',       icon: 'ًںھ™', requiresReceipt: true  },
  { key: 'bank',     labelAr: 'طھط­ظˆظٹظ„ ط¨ظ†ظƒظٹ',    labelEn: 'Bank Transfer', icon: 'ًںڈ¦', requiresReceipt: true  },
] as const;

type MethodKey = typeof PAYMENT_METHODS[number]['key'];

export default function PaymentModal({ onClose, currentBalance, creditPrice = 15 }: PaymentModalProps) {
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const [activeMethod, setActiveMethod] = useState<MethodKey>('card');
  const [currency, setCurrency] = useState<'USD' | 'EGP'>('USD');
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const method = PAYMENT_METHODS.find(m => m.key === activeMethod)!;
  const requiresReceipt = method.requiresReceipt;

  const amountNum = parseFloat(amount) || 0;
  const amountInUsd = currency === 'EGP' ? amountNum / 50 : amountNum;
  const credits = amountInUsd > 0 && creditPrice > 0
    ? (amountInUsd / creditPrice).toFixed(2)
    : '0.00';
  const currentBalanceNum = parseFloat(currentBalance) || 0;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('amount', String(amountNum));
      formData.append('method', activeMethod);
      formData.append('currency', currency);
      if (file) formData.append('screenshot', file);
      formData.append('idempotencyKey', `${Date.now()}-${Math.random().toString(36).slice(2)}`);

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
      if (requiresReceipt) {
        setSubmitted(true);
      } else {
        queryClient.invalidateQueries({ queryKey: ['student-balance'] });
        queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
        queryClient.invalidateQueries({ queryKey: ['payment-history'] });
        onClose();
      }
    },
    onError: (error: { response?: { data?: { message?: string } } } & Error) => {
      const msg = error?.response?.data?.message || error?.message || t('ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط¥ط±ط³ط§ظ„ ط§ظ„ط¯ظپط¹', 'Payment error occurred');
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

  const handleSubmit = () => {
    if (!amountNum || amountNum < 1) {
      alert(t('ط§ظ„ط±ط¬ط§ط، ط¥ط¯ط®ط§ظ„ ظ…ط¨ظ„ط؛ طµط­ظٹط­', 'Please enter a valid amount'));
      return;
    }
    if (requiresReceipt && !file) {
      alert(t('ط§ظ„ط±ط¬ط§ط، ط±ظپط¹ طµظˆط±ط© ط§ظ„ط¥ظٹطµط§ظ„', 'Please upload a receipt screenshot'));
      return;
    }
    submitMutation.mutate();
  };

  // Success state for manual methods
  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
        <div
          className="w-full max-w-md rounded-2xl shadow-2xl animate-scale-in p-8 text-center"
          style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)' }}
        >
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(212,163,83,0.1)' }}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#D4A353">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>
            {t('طھظ… ط¥ط±ط³ط§ظ„ ط·ظ„ط¨ ط§ظ„ط¯ظپط¹', 'Payment Request Sent')}
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {t(
              'ط³ظٹطھظ… ظ…ط±ط§ط¬ط¹ط© ط·ظ„ط¨ظƒ ظ…ظ† ظ‚ط¨ظ„ ط§ظ„ط¥ط¯ط§ط±ط© ظˆط³ظٹظڈط­ط¯ظژظ‘ط« ط±طµظٹط¯ظƒ ط¹ظ†ط¯ ط§ظ„ظ…ظˆط§ظپظ‚ط©. ط¹ط§ط¯ط©ظ‹ ط®ظ„ط§ظ„ 24 ط³ط§ط¹ط©.',
              'Your request will be reviewed by admin and your balance updated upon approval. Usually within 24 hours.'
            )}
          </p>
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['payment-history'] });
              onClose();
            }}
            className="btn-primary w-full py-3"
          >
            {t('ط­ط³ظ†ط§ظ‹طŒ ط´ظƒط±ط§ظ‹', 'Got it, thanks')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl animate-scale-in overflow-hidden"
        style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>{t('ط´ط­ظ† ط§ظ„ط±طµظٹط¯', 'Top Up Balance')}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--text-muted)' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Balance */}
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--bg-light)' }}>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('ط§ظ„ط±طµظٹط¯ ط§ظ„ط­ط§ظ„ظٹ', 'Current Balance')}</span>
            <span className="text-base font-bold" style={{ color: '#D4A353' }}>${currentBalanceNum.toFixed(2)}</span>
          </div>

          {/* Method selector */}
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map(pm => (
              <button
                key={pm.key}
                type="button"
                onClick={() => setActiveMethod(pm.key)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: activeMethod === pm.key ? 'rgba(212,163,83,0.15)' : 'var(--bg-light)',
                  border: activeMethod === pm.key ? '2px solid #D4A353' : '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                }}
              >
                <span>{pm.icon}</span>
                <span className="hidden sm:inline">{lang === 'ar' ? pm.labelAr : pm.labelEn}</span>
              </button>
            ))}
          </div>

          {/* Amount + Currency */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>{t('ط§ظ„ظ…ط¨ظ„ط؛', 'Amount')}</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="input-field w-full"
                placeholder="0.00"
              />
            </div>
            <div className="w-28">
              <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>{t('ط§ظ„ط¹ظ…ظ„ط©', 'Currency')}</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as 'USD' | 'EGP')}
                className="input-field w-full"
              >
                <option value="USD">USD $</option>
                <option value="EGP">EGP ط¬.ظ…</option>
              </select>
            </div>
          </div>

          {amountNum > 0 && (
            <p className="text-xs" style={{ color: '#D4A353' }}>
              â‰ˆ {credits} {t('ط±طµظٹط¯ طھط¹ظ„ظٹظ…ظٹ', 'credits')}
              {currency === 'EGP' && <span className="ms-2 opacity-70">{t('(1 USD = 50 EGP)', '(1 USD = 50 EGP)')}</span>}
            </p>
          )}

          {/* Receipt upload */}
          {requiresReceipt && (
            <div className="space-y-2">
              <label className="block text-sm font-medium" style={{ color: 'var(--text-main)' }}>
                {t('طµظˆط±ط© ط§ظ„ط¥ظٹطµط§ظ„', 'Payment Receipt')}
                <span className="text-xs ms-1" style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
                className="input-field w-full text-sm"
              />
              {filePreview && (
                <div className="relative inline-block mt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={filePreview} alt="receipt" className="max-h-24 rounded-lg border" style={{ borderColor: 'var(--border-color)' }} />
                  <button
                    type="button"
                    onClick={() => { setFile(null); setFilePreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
                    style={{ background: '#ef4444' }}
                  >أ—</button>
                </div>
              )}
              {file && !filePreview && (
                <p className="text-xs" style={{ color: '#22c55e' }}>âœ“ {file.name}</p>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitMutation.isPending || !amountNum}
            className="btn-primary w-full py-3 disabled:opacity-50"
          >
            {submitMutation.isPending
              ? t('ط¬ط§ط±ظٹ ط§ظ„ط¥ط±ط³ط§ظ„...', 'Submitting...')
              : requiresReceipt
                ? t('ط¥ط±ط³ط§ظ„ ط·ظ„ط¨ ط§ظ„ط¯ظپط¹', 'Submit Payment Request')
                : t('ظ…طھط§ط¨ط¹ط© ط§ظ„ط¯ظپط¹', 'Proceed to Payment')}
          </button>

          {requiresReceipt && (
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              {t('ط³ظٹطھظ… ظ…ط±ط§ط¬ط¹ط© ط·ظ„ط¨ ط§ظ„ط¯ظپط¹ ظ…ظ† ظ‚ط¨ظ„ ط§ظ„ط¥ط¯ط§ط±ط©. ط³طھطھظ„ظ‚ظ‰ ط¥ط´ط¹ط§ط±ط§ظ‹ ط¹ظ†ط¯ ط§ظ„ظ…ظˆط§ظپظ‚ط©.', 'Your payment will be reviewed by admin. You will be notified upon approval.')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

