'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type Prefs = {
  email?: boolean;
  sms?: boolean;
  browser?: boolean;
  lesson_reminders?: boolean;
  new_messages?: boolean;
  promotions?: boolean;
  payment_updates?: boolean;
};

type Item = {
  key: keyof Prefs;
  labelAr: string;
  labelEn: string;
};

const ITEMS: Item[] = [
  { key: 'email', labelAr: 'إشعارات البريد', labelEn: 'Email Notifications' },
  { key: 'browser', labelAr: 'إشعارات المتصفح', labelEn: 'Browser Notifications' },
  { key: 'sms', labelAr: 'إشعارات SMS', labelEn: 'SMS Notifications' },
  { key: 'lesson_reminders', labelAr: 'تذكير بالدروس', labelEn: 'Lesson Reminders' },
  { key: 'new_messages', labelAr: 'الرسائل الجديدة', labelEn: 'New Messages' },
  { key: 'promotions', labelAr: 'العروض والتخفيضات', labelEn: 'Promotions & Offers' },
  { key: 'payment_updates', labelAr: 'تحديثات الدفع', labelEn: 'Payment Updates' },
];

export default function NotificationPreferencesPanel({
  lang,
  t,
}: {
  lang: string;
  t: (ar: string, en: string) => string;
}) {
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const { data } = await apiClient.get<Prefs>('/users/me/notification-preferences');
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (patch: Partial<Prefs>) => {
      const { data } = await apiClient.patch<Prefs>(
        '/users/me/notification-preferences',
        patch,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });

  const toggle = (key: keyof Prefs) => {
    if (!prefs) return;
    saveMutation.mutate({ [key]: !prefs[key] });
  };

  return (
    <div className="card p-6 space-y-4">
      <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>
        {t('إعدادات الإشعارات', 'Notification Preferences')}
      </h3>
      {isLoading ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('جاري التحميل...', 'Loading...')}
        </p>
      ) : (
        ITEMS.map((item) => {
          const on = Boolean(prefs?.[item.key]);
          return (
            <label
              key={item.key}
              className="flex items-center justify-between p-4 rounded-xl cursor-pointer"
              style={{ background: 'var(--bg-light)' }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>
                {lang === 'ar' ? item.labelAr : item.labelEn}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                disabled={saveMutation.isPending}
                onClick={() => toggle(item.key)}
                className="relative w-10 h-5 rounded-full transition-colors"
                style={{ background: on ? '#D4A353' : 'var(--border-color)' }}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform start-0.5 ${
                    on ? 'translate-x-[1.25rem] rtl:-translate-x-[1.25rem]' : 'translate-x-0'
                  }`}
                />
              </button>
            </label>
          );
        })
      )}
    </div>
  );
}
