'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

type Payment = {
  id: string;
  userName: string;
  amount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
};

export default function PaymentsTab() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();

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
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/admin/payments/${id}/reject`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
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
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {paymentsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-5 skeleton rounded w-3/4" /></td>
                    ))}
                  </tr>
                ))
              ) : paymentsQuery.data?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
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
                    <td className="px-4 py-3 font-bold" style={{ color: '#22c55e' }}>${payment.amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className="badge text-xs" style={{ background: 'rgba(212, 163, 83,0.1)', color: '#D4A353' }}>
                        {payment.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge text-xs"
                        style={payment.status === 'approved' ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' } : payment.status === 'pending' ? { background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' } : { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                        {payment.status === 'approved' ? (lang === 'ar' ? 'معتمدة' : 'Approved') : payment.status === 'pending' ? (lang === 'ar' ? 'معلقة' : 'Pending') : (lang === 'ar' ? 'مرفوضة' : 'Rejected')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-left">
                      {payment.status === 'pending' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => approveMutation.mutate(payment.id)}
                            disabled={approveMutation.isPending}
                            className="btn-ghost px-2 py-1 text-xs"
                            style={{ color: '#22c55e' }}
                          >
                            {lang === 'ar' ? 'اعتماد' : 'Approve'}
                          </button>
                          <button
                            onClick={() => rejectMutation.mutate(payment.id)}
                            disabled={rejectMutation.isPending}
                            className="btn-ghost px-2 py-1 text-xs"
                            style={{ color: '#ef4444' }}
                          >
                            {lang === 'ar' ? 'رفض' : 'Reject'}
                          </button>
                        </div>
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
