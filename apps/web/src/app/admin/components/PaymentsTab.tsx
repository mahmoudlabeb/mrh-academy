'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

type Payment = {
  id: string;
  userName: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: string;
  receiptUrl?: string;
  adminNote?: string;
  rejectionReason?: string;
  createdAt: string;
};

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export default function PaymentsTab() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  // Per-payment reject reasons to avoid shared-state bug
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [receiptModal, setReceiptModal] = useState<string | null>(null);

  const t = (ar: string, en: string) => lang === 'ar' ? ar : en;

  const paymentsQuery = useQuery({
    queryKey: ['admin-payments'],
    queryFn: async () => {
      const { data } = await apiClient.get<Payment[]>('/admin/payments');
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/admin/payments/${id}/approve`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data } = await apiClient.post(`/admin/payments/${id}/reject`, { reason });
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      // Clear the reason for this specific payment
      setRejectReasons(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
  });

  const handleReject = (payment: Payment) => {
    const reason = rejectReasons[payment.id]?.trim();
    if (!reason) {
      if (!window.confirm(t('رفض بدون سبب؟', 'Reject without a reason?'))) return;
    }
    rejectMutation.mutate({ id: payment.id, reason: reason || undefined });
  };

  const allPayments = paymentsQuery.data ?? [];
  const filtered = statusFilter === 'all'
    ? allPayments
    : allPayments.filter(p => p.status === statusFilter);

  const pendingCount = allPayments.filter(p => p.status === 'pending').length;

  const filters: { key: StatusFilter; ar: string; en: string }[] = [
    { key: 'all',      ar: 'الكل',         en: 'All' },
    { key: 'pending',  ar: 'قيد الانتظار', en: 'Pending' },
    { key: 'approved', ar: 'مقبول',         en: 'Approved' },
    { key: 'rejected', ar: 'مرفوض',         en: 'Rejected' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('سجل المدفوعات والاشتراكات', 'Payment & subscription log')}
          </p>
          {pendingCount > 0 && (
            <p className="text-xs mt-1 font-semibold" style={{ color: '#eab308' }}>
              {pendingCount} {t('طلب بانتظار المراجعة', 'payment(s) pending review')}
            </p>
          )}
        </div>
        {/* Status filter */}
        <div className="flex gap-1.5 flex-wrap">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
              style={{
                background: statusFilter === f.key ? 'rgba(212,163,83,0.15)' : 'var(--bg-light)',
                border: statusFilter === f.key ? '1px solid #D4A353' : '1px solid var(--border-color)',
                color: statusFilter === f.key ? '#D4A353' : 'var(--text-muted)',
              }}
            >
              {lang === 'ar' ? f.ar : f.en}
              {f.key === 'pending' && pendingCount > 0 && (
                <span className="ms-1 px-1 rounded-full text-[10px] font-bold" style={{ background: '#eab308', color: '#000' }}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-light)' }}>
                <th className="text-start px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{t('التاريخ', 'Date')}</th>
                <th className="text-start px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{t('المستخدم', 'User')}</th>
                <th className="text-start px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{t('المبلغ', 'Amount')}</th>
                <th className="text-start px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{t('الطريقة', 'Method')}</th>
                <th className="text-start px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{t('الحالة', 'Status')}</th>
                <th className="text-start px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{t('الإيصال', 'Receipt')}</th>
                <th className="text-start px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{t('إجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {paymentsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 skeleton rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                    {t('لا توجد مدفوعات', 'No payments found')}
                  </td>
                </tr>
              ) : (
                filtered.map((payment) => (
                  <tr key={payment.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(payment.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-main)' }}>
                      {payment.userName}
                    </td>
                    <td className="px-4 py-3 font-bold" style={{ color: '#22c55e' }}>
                      {payment.amount.toFixed(2)} {payment.currency}
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge text-xs" style={{ background: 'rgba(212,163,83,0.1)', color: '#D4A353' }}>
                        {payment.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge text-xs"
                        style={
                          payment.status === 'approved'
                            ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }
                            : payment.status === 'pending'
                              ? { background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' }
                              : { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }
                        }>
                        {payment.status === 'approved'
                          ? t('مقبول', 'Approved')
                          : payment.status === 'pending'
                            ? t('قيد الانتظار', 'Pending')
                            : t('مرفوض', 'Rejected')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {payment.receiptUrl ? (
                        <button
                          onClick={() => setReceiptModal(payment.receiptUrl!)}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                          style={{ background: 'rgba(212,163,83,0.1)', color: '#D4A353', border: '1px solid rgba(212,163,83,0.2)' }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {t('عرض', 'View')}
                        </button>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {payment.status === 'pending' && (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex gap-1">
                            <button
                              onClick={() => approveMutation.mutate(payment.id)}
                              disabled={approveMutation.isPending}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all disabled:opacity-50"
                              style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
                            >
                              {t('اعتماد', 'Approve')}
                            </button>
                            <button
                              onClick={() => handleReject(payment)}
                              disabled={rejectMutation.isPending}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all disabled:opacity-50"
                              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                            >
                              {t('رفض', 'Reject')}
                            </button>
                          </div>
                          {/* Per-payment reject reason input — fixes shared state bug */}
                          <input
                            type="text"
                            placeholder={t('سبب الرفض...', 'Rejection reason...')}
                            value={rejectReasons[payment.id] ?? ''}
                            onChange={(e) => setRejectReasons(prev => ({ ...prev, [payment.id]: e.target.value }))}
                            className="text-xs px-2 py-1 rounded-lg w-40"
                            style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                          />
                        </div>
                      )}
                      {payment.status === 'rejected' && payment.rejectionReason && (
                        <span className="text-xs" style={{ color: '#ef4444' }}>
                          {payment.rejectionReason}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt image modal */}
      {receiptModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setReceiptModal(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setReceiptModal(null)}
              className="absolute -top-10 right-0 text-white text-2xl font-bold opacity-70 hover:opacity-100"
            >×</button>
            {receiptModal.toLowerCase().includes('.pdf') ? (
              <iframe src={receiptModal} className="w-full h-96 rounded-xl" title="receipt" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={receiptModal} alt="Receipt" className="w-full max-h-[80vh] object-contain rounded-xl" />
            )}
            <a
              href={receiptModal}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg"
              style={{ background: 'rgba(212,163,83,0.15)', color: '#D4A353', border: '1px solid rgba(212,163,83,0.3)' }}
            >
              {t('فتح في تبويب جديد', 'Open in new tab')}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
