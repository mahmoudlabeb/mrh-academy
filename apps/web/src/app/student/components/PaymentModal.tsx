'use client';

import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

type ApiPaymentMethod = {
  type: PaymentMethod;
  label: string;
  enabled: boolean;
  details?: string;
};

export default function PaymentModal({ onClose, currentBalance, creditPrice = 15 }: PaymentModalProps) {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const t = (ar: string, en: string) => lang === 'ar' ? ar : en;

  const [activeMethod, setActiveMethod] = useState<PaymentMethod>('card');
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isManual = MANUAL_METHODS.includes(activeMethod);

  const methodsQuery = useQuery({
    queryKey: ['student-payment-methods'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiPaymentMethod[]>('/students/payment-methods');
      return data;
    },
  });

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

  const methodDetails = methodsQuery.data?.find((m) => m.type === activeMethod);

  const methodLabels: Record<PaymentMethod, { name: string; details?: string }> = {
    card: {
      name: lang === 'ar' ? 'بطاقة ائتمان' : 'Credit Card',
      details: lang === 'ar' ? 'فيزا - ماستركارد' : 'Visa - Mastercard',
    },
    paypal: {
      name: 'PayPal',
      details: methodDetails?.details || (lang === 'ar' ? 'الدفع عبر PayPal' : 'Pay with PayPal'),
    },
    vodafone: {
      name: lang === 'ar' ? 'فودافون كاش' : 'Vodafone Cash',
      details: methodDetails?.details || t('غير مُعد', 'Not configured'),
    },
    instapay: {
      name: lang === 'ar' ? 'انستاباي' : 'Instapay',
      details: methodDetails?.details || t('غير مُعد', 'Not configured'),
    },
    binance: {
      name: 'Binance',
      details: methodDetails?.details || t('غير مُعد', 'Not configured'),
    },
    bank: {
      name: lang === 'ar' ? 'تحويل بنكي' : 'Bank Transfer',
      details: methodDetails?.details || t('غير مُعد', 'Not configured'),
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
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeMethod === pm.key ? 'ring-2 ring-[#D4A353]' : ''}`}
                style={{
                  background: activeMethod === pm.key ? 'var(--bg-light)' : 'transparent',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <span className="me-1">{pm.icon}</span>
                {lang === 'ar' ? pm.labelAr : pm.labelEn}
              </button>
            ))}
          </div>

          <div className="p-4 rounded-xl" style={{ background: 'var(--bg-light)' }}>
            <p className="font-medium" style={{ color: 'var(--text-main)' }}>{methodLabels[activeMethod].name}</p>
            {methodLabels[activeMethod].details && (
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{methodLabels[activeMethod].details}</p>
            )}
          </div>

          <div>
            <label className="block text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
              {t('المبلغ (USD)', 'Amount (USD)')}
            </label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-field w-full"
              placeholder="0.00"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {t(`≈ ${credits} رصيد`, `≈ ${credits} credits`)}
            </p>
          </div>

          {isManual && (
            <div>
              <label className="block text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
                {t('صورة الإيصال', 'Receipt Screenshot')}
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="input-field w-full text-sm"
              />
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            className="btn-primary w-full py-3"
          >
            {submitMutation.isPending
              ? t('جاري الإرسال...', 'Submitting...')
              : t('إرسال الدفع', 'Submit Payment')}
          </button>
        </div>
      </div>
    </div>
  );
}
