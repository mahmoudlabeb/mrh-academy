'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

type Payout = {
  id: string;
  tutorName: string;
  amount: number;
  method: string;
  accountDetails: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
};

export default function AdminPayoutsPage() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();

  const t = (ar: string, en: string) => lang === 'ar' ? ar : en;

  const { data: payouts = [], isLoading } = useQuery<Payout[]>({
    queryKey: ['admin-payouts'],
    queryFn: async () => {
      const { data } = await apiClient.get<Payout[]>('/admin/payouts');
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/admin/payouts/${id}/approve`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-payouts'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await apiClient.post(`/admin/payouts/${id}/reject`, { reason });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-payouts'] }),
  });

  const pendingPayouts = payouts.filter(p => p.status === 'pending');
  const processedPayouts = payouts.filter(p => p.status !== 'pending');

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-8 h-8 border-2 border-[#D4A353] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>
          {t('طلبات السحب', 'Payout Requests')}
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          {t('طلبات سحب الأرباح من المدرسين.', 'Tutor payout withdrawal requests.')}
        </p>

        {pendingPayouts.length === 0 ? (
          <div className="card p-8 text-center" style={{ color: 'var(--text-muted)' }}>
            {t('لا توجد طلبات سحب معلقة', 'No pending payout requests')}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {pendingPayouts.map(payout => (
              <div key={payout.id} className="card-gold p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-lg" style={{ color: 'var(--text-main)' }}>
                      ${payout.amount.toFixed(2)}
                    </p>
                    <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {payout.tutorName}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {payout.method} · {payout.accountDetails}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(payout.createdAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => approveMutation.mutate(payout.id)}
                      disabled={approveMutation.isPending}
                      className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #F3E1B9, #B89754)', color: '#0F3A40' }}>
                      {t('اعتماد', 'Approve')}
                    </button>
                    <button onClick={() => {
                      const reason = prompt(t('سبب الرفض:', 'Rejection reason:'));
                      if (reason !== null) rejectMutation.mutate({ id: payout.id, reason: reason || 'No reason provided' });
                    }}
                      disabled={rejectMutation.isPending}
                      className="px-4 py-2 rounded-lg text-sm font-semibold border disabled:opacity-50"
                      style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444' }}>
                      {t('رفض', 'Reject')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {processedPayouts.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-main)' }}>
            {t('سابق', 'History')}
          </h3>
          <div className="flex flex-col gap-3">
            {processedPayouts.map(payout => (
              <div key={payout.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold" style={{ color: 'var(--text-main)' }}>
                    ${payout.amount.toFixed(2)} · {payout.tutorName}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {payout.method}
                  </p>
                </div>
                <span className="badge text-xs"
                  style={payout.status === 'success'
                    ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }
                    : { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {payout.status === 'success' ? t('مقبول', 'Approved') : t('مرفوض', 'Rejected')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
