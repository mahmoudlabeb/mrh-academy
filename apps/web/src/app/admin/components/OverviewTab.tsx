'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

type AdminStats = {
  totalEarnings: number;
  totalStudents: number;
  pendingApplications: number;
  openReports: number;
  totalTutors: number;
  completedLessons: number;
};

type RecentActivity = {
  id: string;
  type: string;
  description: string;
  user: string;
  createdAt: string;
};

export default function OverviewTab() {
  const { lang } = useLanguage();

  const statsQuery = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminStats>('/admin/stats');
      return data;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const activityQuery = useQuery({
    queryKey: ['admin-recent-activity'],
    queryFn: async () => {
      const { data } = await apiClient.get<RecentActivity[]>('/admin/activity/recent');
      return data;
    },
    staleTime: 30_000,
  });

  const stats = statsQuery.data;

  const statCards = [
    {
      label: lang === 'ar' ? 'إجمالي الأرباح' : 'Total Earnings',
      value: stats?.totalEarnings ?? 0,
      prefix: '$',
      color: '#22c55e',
      icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      label: lang === 'ar' ? 'الطلاب النشطين' : 'Active Students',
      value: stats?.totalStudents ?? 0,
      color: '#D4A353',
      icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" /></svg>,
    },
    {
      label: lang === 'ar' ? 'طلبات مدرسين معلقة' : 'Pending Tutor Requests',
      value: stats?.pendingApplications ?? 0,
      color: '#eab308',
      icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>,
    },
    {
      label: lang === 'ar' ? 'البلاغات' : 'Reports',
      value: stats?.openReports ?? 0,
      color: '#ef4444',
      icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>,
    },
  ];

  const quickActions = [
    { label: lang === 'ar' ? 'مراجعة طلبات المدرسين' : 'Review Tutor Requests', tab: 'tutors' },
    { label: lang === 'ar' ? 'إدارة الكورسات' : 'Manage Courses', tab: 'courses' },
    { label: lang === 'ar' ? 'البلاغات الجديدة' : 'New Reports', tab: 'reports' },
    { label: lang === 'ar' ? 'إعدادات المنصة' : 'Platform Settings', tab: 'settings' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="card-dark p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{stat.label}</span>
              <span style={{ color: stat.color }}>{stat.icon}</span>
            </div>
            <p className="text-3xl font-bold" style={{ color: stat.color }}>
              {statsQuery.isLoading ? (
                <span className="inline-block w-16 h-8 skeleton rounded" />
              ) : (
                <>{stat.prefix || ''}{stat.value.toLocaleString()}</>
              )}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-main)' }}>
            {lang === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.tab}
                onClick={() => {
                  const event = new CustomEvent('admin-navigate', { detail: { tab: action.tab } });
                  window.dispatchEvent(event);
                }}
                className="btn-secondary justify-center py-4 text-sm"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-main)' }}>
            {lang === 'ar' ? 'آخر النشاطات' : 'Recent Activity'}
          </h3>
          <div className="space-y-3">
            {activityQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-8 h-8 skeleton rounded-full shrink-0" />
                  <div className="flex-1">
                    <div className="h-4 skeleton rounded w-3/4 mb-1" />
                    <div className="h-3 skeleton rounded w-1/2" />
                  </div>
                </div>
              ))
            ) : activityQuery.data?.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ar' ? 'لا توجد نشاطات حديثة' : 'No recent activity'}
              </p>
            ) : (
              activityQuery.data?.slice(0, 6).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 pb-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: '#D4A353' }}>
                    {activity.user[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-main)' }}>{activity.description}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {activity.user} &middot; {new Date(activity.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
