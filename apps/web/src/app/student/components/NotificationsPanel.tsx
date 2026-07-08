'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

type Notification = {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

interface NotificationsPanelProps {
  onClose: () => void;
}

export default function NotificationsPanel({ onClose }: NotificationsPanelProps) {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const t = (ar: string, en: string) => (lang === 'ar' ? ar : en);

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications');
      return data;
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="font-bold" style={{ color: 'var(--text-main)' }}>{t('الإشعارات', 'Notifications')}</h3>
          <div className="flex items-center gap-2">
            {notifications.some((n) => !n.isRead) && (
              <button
                type="button"
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
                className="text-xs link"
              >
                {t('قراءة الكل', 'Mark all read')}
              </button>
            )}
            <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('جاري التحميل...', 'Loading...')}</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('لا توجد إشعارات', 'No notifications')}</div>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => {
                  if (!notification.isRead) markReadMutation.mutate(notification.id);
                }}
                className="w-full text-right p-4 border-b transition-colors hover:bg-white/5"
                style={{
                  borderColor: 'var(--border-color)',
                  background: notification.isRead ? 'transparent' : 'rgba(212, 163, 83,0.06)',
                }}
              >
                <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{notification.title}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{notification.body}</p>
                <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
                  {new Date(notification.createdAt).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')}
                </p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
