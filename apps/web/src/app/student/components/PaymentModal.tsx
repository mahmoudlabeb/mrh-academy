'use client';

import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';
import { PaymentMethod } from '@mrh/types';

interface PaymentModalProps {
  onClose: () => void;
  currentBalance: string;
  creditPrice?: number;
}

// Backend PaymentMethod enum values — must match exactly
const PAYMENT_METHODS = [
  { key: PaymentMethod.CARD, labelAr: 'بطاقة ائتمان', labelEn: 'Credit Card', icon: '💳', requiresReceipt: false },
  { key: PaymentMethod.PAYPAL, labelAr: 'PayPal', labelEn: 'PayPal', icon: '🅿️', requiresReceipt: false },
  { key: PaymentMethod.VODAFONE, labelAr: 'فودافون كاش', labelEn: 'Vodafone Cash', icon: '📱', requiresReceipt: true },
  { key: PaymentMethod.INSTAPAY, labelAr: 'انستاباي', labelEn: 'Instapay', icon: '⚡', requiresReceipt: true },
  { key: PaymentMethod.BINANCE, labelAr: 'بايننس', labelEn: 'Binance', icon: '🪙', requiresReceipt: true },
  { key: PaymentMethod.BANK, labelAr: 'تحويل بنكي', labelEn: 'Bank Transfer', icon: '🏦', requiresReceipt: true },
] as const;

type MethodKey = typeof PAYMENT_METHODS[number]['key'];

interface PaymentMethodConfig {
  type: string;
  label: string;
  enabled: boolean;
  details: string | null;
}

export default function PaymentModal({ onClose, currentBalance, creditPrice = 15 }: PaymentModalProps) {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const t = (ar: string, en: string) => lang === 'ar' ? ar : en;

  const [activeMethod, setActiveMethod] = useState<MethodKey>(PaymentMethod.CARD);
  const [currency, setCurrency] = useState<'USD' | 'EGP'>('USD');
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const paymentMethodsQuery = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const { data } = await apiClient.get<PaymentMethodConfig[]>('/payment-methods');
      return data;
    },
  });
  const enabledMethodKeys = new Set(
    (paymentMethodsQuery.data ?? [])
      .filter(config => config.enabled)
      .map(config => config.type),
  );
  const paymentMethods = PAYMENT_METHODS.filter(method => enabledMethodKeys.has(method.key));
  const method = paymentMethods.find(item => item.key === activeMethod) ?? paymentMethods[0];
  const requiresReceipt = method?.requiresReceipt ?? false;

  const amountNum = parseFloat(amount) || 0;
  const amountInUsd = currency === 'EGP' ? amountNum / 50 : amountNum;
  const credits = amountInUsd > 0 && creditPrice > 0
    ? (amountInUsd / creditPrice).toFixed(2)
    : '0.00';
  const currentBalanceNum = parseFloat(currentBalance) || 0;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!method) throw new Error(t('لا توجد وسيلة دفع متاحة', 'No payment method is available'));
      const formData = new FormData();
      formData.append('amount', String(amountNum));
      formData.append('method', method.key);
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
      const msg = error?.response?.data?.message || error?.message || t('حدث خطأ أثناء إرسال الدفع', 'Payment error occurred');
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
    if (!method) {
      alert(t('لا توجد وسيلة دفع متاحة', 'No payment method is available'));
      return;
    }
    if (!amountNum || amountNum < 1) {
      alert(t('الرجاء إدخال مبلغ صحيح', 'Please enter a valid amount'));
      return;
    }
    if (requiresReceipt && !file) {
      alert(t('الرجاء رفع صورة الإيصال', 'Please upload a receipt screenshot'));
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
            {t('تم إرسال طلب الدفع', 'Payment Request Sent')}
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {t(
              'سيتم مراجعة طلبك من قبل الإدارة وسيُحدَّث رصيدك عند الموافقة. عادةً خلال 24 ساعة.',
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
            {t('حسناً، شكراً', 'Got it, thanks')}
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
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>{t('شحن الرصيد', 'Top Up Balance')}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--text-muted)' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Balance */}
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--bg-light)' }}>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('الرصيد الحالي', 'Current Balance')}</span>
            <span className="text-base font-bold" style={{ color: '#D4A353' }}>${currentBalanceNum.toFixed(2)}</span>
          </div>

          {/* Method selector */}
          <div className="flex flex-wrap gap-2">
            {paymentMethodsQuery.isLoading && (
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {t('جاري تحميل وسائل الدفع...', 'Loading payment methods...')}
              </span>
            )}
            {paymentMethodsQuery.isError && (
              <span className="text-sm" style={{ color: '#ef4444' }}>
                {t('تعذر تحميل وسائل الدفع', 'Could not load payment methods')}
              </span>
            )}
            {!paymentMethodsQuery.isLoading && !paymentMethodsQuery.isError && paymentMethods.length === 0 && (
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {t('لا توجد وسيلة دفع متاحة حالياً', 'No payment method is currently available')}
              </span>
            )}
            {paymentMethods.map(pm => (
              <button
                key={pm.key}
                type="button"
                onClick={() => setActiveMethod(pm.key)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: method?.key === pm.key ? 'rgba(212,163,83,0.15)' : 'var(--bg-light)',
                  border: method?.key === pm.key ? '2px solid #D4A353' : '1px solid var(--border-color)',
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
              <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>{t('المبلغ', 'Amount')}</label>
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
              <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>{t('العملة', 'Currency')}</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as 'USD' | 'EGP')}
                className="input-field w-full"
              >
                <option value="USD">USD $</option>
                <option value="EGP">EGP ج.م</option>
              </select>
            </div>
          </div>

          {amountNum > 0 && (
            <p className="text-xs" style={{ color: '#D4A353' }}>
              ≈ {credits} {t('رصيد تعليمي', 'credits')}
              {currency === 'EGP' && <span className="ms-2 opacity-70">{t('(1 USD = 50 EGP)', '(1 USD = 50 EGP)')}</span>}
            </p>
          )}

          {/* Receipt upload */}
          {requiresReceipt && (
            <div className="space-y-2">
              <label className="block text-sm font-medium" style={{ color: 'var(--text-main)' }}>
                {t('صورة الإيصال', 'Payment Receipt')}
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
                  >×</button>
                </div>
              )}
              {file && !filePreview && (
                <p className="text-xs" style={{ color: '#22c55e' }}>✓ {file.name}</p>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitMutation.isPending || paymentMethodsQuery.isLoading || !method || !amountNum}
            className="btn-primary w-full py-3 disabled:opacity-50"
          >
            {submitMutation.isPending
              ? t('جاري الإرسال...', 'Submitting...')
              : requiresReceipt
                ? t('إرسال طلب الدفع', 'Submit Payment Request')
                : t('متابعة الدفع', 'Proceed to Payment')}
          </button>

          {requiresReceipt && (
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              {t('سيتم مراجعة طلب الدفع من قبل الإدارة. ستتلقى إشعاراً عند الموافقة.', 'Your payment will be reviewed by admin. You will be notified upon approval.')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
