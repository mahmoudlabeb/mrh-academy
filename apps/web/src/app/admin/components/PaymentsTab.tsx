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

export default function PaymentsTab() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState('');

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      setRejectReason('');
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {lang === 'ar' ? 'سجل المدفوعات والاشتراكات' : 'Payment & subscription log'}
      </p>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-light)' }}>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'المستخدم' : 'User'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'المبلغ' : 'Amount'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'طريقة الدفع' : 'Method'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'الإيصال' : 'Receipt'}</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {paymentsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-5 skeleton rounded w-3/4" /></td>
                    ))}
                  </tr>
                ))
              ) : paymentsQuery.data?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                    {lang === 'ar' ? 'لا توجد مدفوعات' : 'No payments'}
                  </td>
                </tr>
              ) : (
                paymentsQuery.data?.map((payment) => (
                  <tr key={payment.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td className="px-4 py-3" style={{ color: 'var(--text-main)' }}>
                      {new Date(payment.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-main)' }}>{payment.userName}</td>
                    <td className="px-4 py-3 font-bold" style={{ color: '#22c55e' }}>{payment.amount.toFixed(2)} {payment.currency}</td>
                    <td className="px-4 py-3">
                      <span className="badge text-xs" style={{ background: 'rgba(212, 163, 83,0.1)', color: '#D4A353' }}>
                        {payment.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge text-xs"
                        style={payment.status === 'approved' ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' } : payment.status === 'pending' ? { background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' } : { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                        {payment.status === 'approved' ? (lang === 'ar' ? 'مقبول' : 'Approved') : payment.status === 'pending' ? (lang === 'ar' ? 'قيد الانتظار' : 'Pending') : (lang === 'ar' ? 'مرفوض' : 'Rejected')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {payment.receiptUrl ? (
                        <a
                          href={payment.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                          style={{ background: 'rgba(212, 163, 83,0.1)', color: '#D4A353', border: '1px solid rgba(212, 163, 83,0.2)' }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {lang === 'ar' ? 'عرض' : 'View'}
                        </a>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-left">
                      {payment.status === 'pending' && (
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-1">
                            <button
                              onClick={() => approveMutation.mutate(payment.id)}
                              disabled={approveMutation.isPending}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                              style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
                            >
                              {lang === 'ar' ? 'اعتماد' : 'Approve'}
                            </button>
                            <button
                              onClick={() => {
                                if (rejectReason.trim()) {
                                  rejectMutation.mutate({ id: payment.id, reason: rejectReason.trim() });
                                } else if (window.confirm(lang === 'ar' ? 'هل تريد رفض هذا الدفع بدون سبب؟' : 'Reject this payment without a reason?')) {
                                  rejectMutation.mutate({ id: payment.id });
                                }
                              }}
                              disabled={rejectMutation.isPending}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                            >
                              {lang === 'ar' ? 'رفض' : 'Reject'}
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder={lang === 'ar' ? 'سبب الرفض...' : 'Rejection reason...'}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
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
    </div>
  );
}
