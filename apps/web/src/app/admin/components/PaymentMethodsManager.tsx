'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

type PaymentMethod = {
  id: string;
  type: string;
  label: string;
  enabled: boolean;
  details: string | null;
  sortOrder: number;
};

export default function PaymentMethodsManager() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();

  const t = (ar: string, en: string) => lang === 'ar' ? ar : en;

  const { data: methods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ['admin-payment-methods'],
    queryFn: async () => {
      const { data } = await apiClient.get<PaymentMethod[]>('/admin/payment-methods');
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await apiClient.put(`/admin/payment-methods/${id}`, { enabled });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] }),
  });

  return (
    <div>
      <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>
        {t('إدارة طرق الدفع', 'Payment Methods Management')}
      </h2>

      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        {t('فعّل أو عطّل طرق الدفع المتاحة للطلاب.', 'Enable or disable available payment methods for students.')}
      </p>

      <div className="flex flex-col gap-3">
        {methods.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card-gold p-4">
              <div className="h-5 skeleton rounded w-1/3" />
            </div>
          ))
        ) : (
          methods.map(method => (
            <div key={method.id} className="card-gold p-4 flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold" style={{ color: 'var(--text-main)' }}>
                    {method.label}
                  </p>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: 'rgba(212, 163, 83, 0.1)',
                      color: '#D4A353',
                    }}>
                    {method.type}
                  </span>
                </div>
                {method.details && (
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    {method.details}
                  </p>
                )}
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={method.enabled}
                  onChange={(e) => toggleMutation.mutate({ id: method.id, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                  style={{ background: method.enabled ? '#D4A353' : 'var(--border-color)' }} />
              </label>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
