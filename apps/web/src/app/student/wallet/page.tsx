'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

type PaymentMethod = {
  id: string;
  name: string;
  label: string;
};

type PaymentRecord = {
  id: string;
  amount: number;
  method: string;
  currency: string;
  status: string;
  createdAt: string;
};

const topUpSchema = z.object({
  amount: z.string().min(1, 'Amount is required'),
  currency: z.enum(['USD', 'EGP']),
  method: z.string().min(1, 'Select a payment method'),
  adminNote: z.string().optional(),
});

type TopUpForm = z.infer<typeof topUpSchema>;

const RECEIPT_METHODS = ['vodafone_cash', 'instapay', 'binance', 'bank_transfer'];

export default function StudentWalletPage() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const t = (ar: string, en: string) => lang === 'ar' ? ar : en;

  const { data: balance } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: async () => {
      const { data } = await apiClient.get('/students/balance');
      return data as { balance: number; creditPrice: number };
    },
  });

  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ['wallet-payment-methods'],
    queryFn: async () => {
      const { data } = await apiClient.get('/payment-methods');
      return data;
    },
  });

  const { data: paymentHistory = [] } = useQuery<PaymentRecord[]>({
    queryKey: ['wallet-history'],
    queryFn: async () => {
      const { data } = await apiClient.get('/students/payment-history');
      return data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await apiClient.post('/payments/submit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data as { checkoutUrl?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-history'] });
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setSuccessMsg(t('تم إرسال طلب الدفع بنجاح', 'Payment submitted successfully'));
      }
    },
  });

  const { register, handleSubmit, watch, formState: { errors } } = useForm<TopUpForm>({
    resolver: zodResolver(topUpSchema),
    defaultValues: { currency: 'USD' },
  });

  const selectedMethod = watch('method');
  const needsReceipt = RECEIPT_METHODS.includes(selectedMethod);

  const onSubmit = (data: TopUpForm) => {
    const formData = new FormData();
    const amountNum = parseFloat(data.amount);
    if (isNaN(amountNum) || amountNum < 5) return;
    formData.append('amount', String(amountNum));
    formData.append('currency', data.currency);
    formData.append('method', data.method);
    if (data.adminNote) formData.append('adminNote', data.adminNote);
    if (selectedFile) formData.append('screenshot', selectedFile);
    formData.append('idempotencyKey', `${Date.now()}-${Math.random()}`);
    submitMutation.mutate(formData);
  };

  const statusBadge = (status: string) => {
    const cfg: Record<string, { ar: string; en: string; bg: string; color: string }> = {
      approved: { ar: 'مقبول', en: 'Approved', bg: 'rgba(34,197,94,0.1)', color: '#22c55e' },
      pending: { ar: 'قيد الانتظار', en: 'Pending', bg: 'rgba(234,179,8,0.1)', color: '#eab308' },
      rejected: { ar: 'مرفوض', en: 'Rejected', bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
    };
    const c = cfg[status] || cfg.pending;
    return <span className="badge text-xs" style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}20` }}>{lang === 'ar' ? c.ar : c.en}</span>;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>
        {t('المحفظة', 'Wallet')}
      </h1>

      <div className="card-gold p-6 text-center">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('الرصيد الحالي', 'Current Balance')}</p>
        <p className="text-4xl font-bold mt-2" style={{ color: '#D4A353' }}>
          ${Number(balance?.balance ?? 0).toFixed(2)}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          1 {t('ائتمان', 'Credit')} = ${balance?.creditPrice ?? 15}
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e' }}>
          {successMsg}
        </div>
      )}

      {submitMutation.error && (
        <div className="p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
          {(submitMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message || t('فشل الدفع', 'Payment failed')}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-4">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{t('اشحن رصيدك', 'Top Up Balance')}</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('المبلغ', 'Amount')}</label>
            <input type="number" step="0.01" min="5" {...register('amount')} className="input-field w-full" placeholder="10.00" />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('الحد الأدنى 5 دولار', 'Minimum $5')}</p>
            {errors.amount && <p className="text-xs" style={{ color: '#ef4444' }}>{errors.amount.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('العملة', 'Currency')}</label>
            <select {...register('currency')} className="input-field w-full">
              <option value="USD">USD</option>
              <option value="EGP">EGP</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('طريقة الدفع', 'Payment Method')}</label>
          {paymentMethods.length === 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {['card', 'paypal', 'vodafone_cash', 'instapay', 'binance', 'bank_transfer'].map(m => (
                <label key={m} className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer border transition-all ${selectedMethod === m ? 'border-[#D4A353] bg-[rgba(212,163,83,0.1)]' : 'border-[var(--border-color)]'}`}>
                  <input type="radio" value={m} {...register('method')} className="hidden" />
                  <span className="text-sm" style={{ color: 'var(--text-main)' }}>{m}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map(m => (
                <label key={m.id} className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer border transition-all ${selectedMethod === m.id ? 'border-[#D4A353] bg-[rgba(212,163,83,0.1)]' : 'border-[var(--border-color)]'}`}>
                  <input type="radio" value={m.id} {...register('method')} className="hidden" />
                  <span className="text-sm" style={{ color: 'var(--text-main)' }}>{m.label}</span>
                </label>
              ))}
            </div>
          )}
          {errors.method && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{errors.method.message}</p>}
        </div>

        {needsReceipt && (
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('إيصال الدفع', 'Payment Receipt')}</label>
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setSelectedFile(e.target.files?.[0] || null)} className="text-sm" style={{ color: 'var(--text-main)' }} />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('ملاحظة (اختياري)', 'Note (optional)')}</label>
          <input {...register('adminNote')} className="input-field w-full" placeholder={t('ملاحظة للمشرف', 'Note for admin')} />
        </div>

        <button type="submit" disabled={submitMutation.isPending || (needsReceipt && !selectedFile)}
          className="btn-primary w-full py-3">
          {submitMutation.isPending ? (
            <span className="flex items-center gap-2 justify-center">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
              {t('جاري...', 'Processing...')}
            </span>
          ) : (
            t('اشحن', 'Top Up')
          )}
        </button>
      </form>

      <div>
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-main)' }}>{t('سجل المدفوعات', 'Payment History')}</h2>
        {paymentHistory.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('لا توجد مدفوعات بعد', 'No payments yet')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {paymentHistory.map(p => (
              <div key={p.id} className="card flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold" style={{ color: 'var(--text-main)' }}>${p.amount.toFixed(2)} {p.currency}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {p.method} · {new Date(p.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                  </p>
                </div>
                {statusBadge(p.status)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
