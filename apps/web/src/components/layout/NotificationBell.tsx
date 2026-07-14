'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

type Notification = {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export default function NotificationBell() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const bellRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await apiClient.get<Notification[]>('/notifications');
      setNotifications(data || []);
    } catch {
      // silent — notifications are non-critical
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markRead = async (id: string) => {
    try {
      await apiClient.post(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
    } catch {
      // silent
    }
  };

  const markAllRead = async () => {
    try {
      await apiClient.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {
      // silent
    }
  };

  if (!user) return null;

  return (
    <div ref={bellRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setBellOpen(prev => !prev)}
        className="p-2 rounded-lg transition-colors hover:bg-[#1D535B]"
        style={{ color: '#FFFFF0' }}
        aria-label={isAr ? 'الإشعارات' : 'Notifications'}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            background: '#ef4444', color: 'white', fontSize: 10,
            fontWeight: 700, minWidth: 18, height: 18,
            borderRadius: 9, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: '0 3px'
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {bellOpen && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0,
            width: 320, maxHeight: 480, overflowY: 'auto', zIndex: 100,
            borderRadius: '1rem', background: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <span className="font-semibold text-sm" style={{ color: 'var(--text-main)' }}>
              {isAr ? 'الإشعارات' : 'Notifications'}
            </span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs" style={{ color: '#D4A353' }}>
                {isAr ? 'تحديد الكل كمقروء' : 'Mark all read'}
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              {isAr ? 'لا توجد إشعارات' : 'No notifications'}
            </div>
          ) : (
            <div>
              {notifications.slice(0, 10).map(notification => (
                <div
                  key={notification.id}
                  onClick={() => { if (!notification.isRead) markRead(notification.id); }}
                  className="px-4 py-3 border-b cursor-pointer transition-colors hover:bg-[rgba(212,163,83,0.05)]"
                  style={{
                    borderColor: 'var(--border-color)',
                    background: notification.isRead ? 'transparent' : 'rgba(212, 163, 83, 0.08)',
                    borderRight: notification.isRead ? 'none' : '3px solid #D4A353',
                  }}
                >
                  <p className="text-sm" style={{ color: 'var(--text-main)' }}>
                    {notification.message}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {new Date(notification.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}