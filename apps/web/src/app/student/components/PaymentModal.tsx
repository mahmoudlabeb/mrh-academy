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

const paymentMethods = [
  { key: 'card', labelAr: 'بطاقة ائتمان', labelEn: 'Credit Card', icon: '💳' },
  { key: 'paypal', labelAr: 'PayPal', labelEn: 'PayPal', icon: '🅿️' },
  { key: 'vodafone', labelAr: 'فودافون كاش', labelEn: 'Vodafone Cash', icon: '📱' },
  { key: 'instapay', labelAr: 'انستاباي', labelEn: 'Instapay', icon: '⚡' },
  { key: 'binance', labelAr: 'بايننس', labelEn: 'Binance', icon: '🪙' },
  { key: 'bank', labelAr: 'تحويل بنكي', labelEn: 'Bank Transfer', icon: '🏦' },
] as const;

type PaymentMethod = (typeof paymentMethods)[number]['key'];

const MANUAL_METHODS: PaymentMethod[] = ['vodafone', 'instapay', 'binance', 'bank'];

export default function PaymentModal({ onClose, currentBalance, creditPrice = 15 }: PaymentModalProps) {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const t = (ar: string, en: string) => lang === 'ar' ? ar : en;

  const [activeMethod, setActiveMethod] = useState<PaymentMethod>('card');
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isManual = MANUAL_METHODS.includes(activeMethod);



  const submitMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await apiClient.post('/payments/submit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        queryClient.invalidateQueries({ queryKey: ['student-balance'] });
        onClose();
      }
    },
  });

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      alert(t('الرجاء إدخال مبلغ صحيح', 'Please enter a valid amount'));
      return;
    }
    if (isManual && !file) {
      alert(t('الرجاء رفع صورة الإيصال', 'Please upload a receipt screenshot'));
      return;
    }
    const formData = new FormData();
    formData.append('amount', amount);
    formData.append('method', activeMethod);
    if (file) formData.append('screenshot', file);
    submitMutation.mutate(formData);
  };

  const credits = amount && creditPrice > 0
    ? (parseFloat(amount) / creditPrice).toFixed(2)
    : '0.00';
  const currentBalanceNum = parseFloat(currentBalance) || 0;

  const methodLabels: Record<PaymentMethod, { name: string; details?: string }> = {
    card: {
      name: lang === 'ar' ? 'بطاقة ائتمان' : 'Credit Card',
      details: lang === 'ar' ? 'فيزا - ماستركارد' : 'Visa - Mastercard',
    },
    paypal: { name: 'PayPal', details: lang === 'ar' ? 'الدفع عبر PayPal' : 'Pay with PayPal' },
    vodafone: {
      name: lang === 'ar' ? 'فودافون كاش' : 'Vodafone Cash',
      details: lang === 'ar' ? '01000000000' : '01000000000',
    },
    instapay: {
      name: lang === 'ar' ? 'انستاباي' : 'Instapay',
      details: lang === 'ar' ? '@mrh_academy' : '@mrh_academy',
    },
    binance: {
      name: 'Binance',
      details: lang === 'ar' ? 'ID: 123456789' : 'ID: 123456789',
    },
    bank: {
      name: lang === 'ar' ? 'تحويل بنكي' : 'Bank Transfer',
      details: lang === 'ar' ? 'البنك الأهلي المصري - حساب 123456789' : 'NBE - Account 123456789',
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl animate-scale-in overflow-hidden"
        style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>{t('اشتراك', 'Subscribe')}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--text-muted)' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--bg-light)' }}>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('الرصيد الحالي', 'Current Balance')}</span>
            <span className="text-lg font-bold" style={{ color: '#D4A353' }}>{currentBalanceNum.toFixed(2)} {t('رصيد', 'Credits')}</span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {paymentMethods.map((pm) => (
              <button
                key={pm.key}
                onClick={() => setActiveMethod(pm.key)}
                className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl text-xs font-medium transition-all shrink-0 min-w-[80px]"
                style={{
                  background: activeMethod === pm.key ? 'rgba(212, 163, 83,0.1)' : 'var(--bg-light)',
                  border: activeMethod === pm.key ? '2px solid #D4A353' : '2px solid transparent',
                  color: activeMethod === pm.key ? '#D4A353' : 'var(--text-muted)',
                }}
              >
                <span className="text-lg">{pm.icon}</span>
                <span className="text-[10px]">{lang === 'ar' ? pm.labelAr : pm.labelEn}</span>
              </button>
            ))}
          </div>

          <div className="p-4 rounded-xl" style={{ background: 'var(--bg-light)' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-main)' }}>{methodLabels[activeMethod].name}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{methodLabels[activeMethod].details}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
              {t('المبلغ ($)', 'Amount ($)')}
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="1"
              step="0.01"
              className="input-field text-sm"
            />
            {amount && parseFloat(amount) > 0 && (
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('ستحصل على', 'You will get')} <span className="font-semibold text-[#D4A353]">{credits}</span> {t('رصيد', 'credits')}
                <span className="mx-1">·</span>
                {t('سعر الصرف', 'Rate')}: ${creditPrice} = 1 {t('رصيد', 'credit')}
              </p>
            )}
          </div>

          {isManual && (
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
                {t('صورة الإيصال', 'Receipt Screenshot')}
              </label>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors hover:border-[#D4A353]"
                style={{ borderColor: file ? '#D4A353' : 'var(--border-color)' }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#22c55e">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-medium" style={{ color: '#22c55e' }}>{file.name}</span>
                  </div>
                ) : (
                  <div>
                    <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('اضغط لرفع صورة الإيصال', 'Click to upload receipt')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitMutation.isPending || !amount || parseFloat(amount) <= 0}
            className="btn-primary w-full py-3 text-base"
          >
            {submitMutation.isPending ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : t('تأكيد الدفع', 'Confirm Payment')}
          </button>
        </div>
      </div>
    </div>
  );
}
