'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

type Report = {
  id: string;
  reporterName: string;
  reporterEmail: string;
  issueType: string;
  description: string;
  createdAt: string;
};

export default function ReportsTab() {
  const { lang } = useLanguage();

  const reportsQuery = useQuery({
    queryKey: ['admin-reports'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Report[]; total: number }>('/admin/reports');
      return data.data;
    },
  });

  const sortedReports = reportsQuery.data?.slice().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {lang === 'ar' ? 'جميع البلاغات مرتبة من الأحدث إلى الأقدم' : 'All reports sorted by newest'}
      </p>

      <div className="space-y-3">
        {reportsQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5">
              <div className="flex gap-3">
                <div className="w-10 h-10 skeleton rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 skeleton rounded w-1/3" />
                  <div className="h-3 skeleton rounded w-1/4" />
                  <div className="h-3 skeleton rounded w-full" />
                </div>
              </div>
            </div>
          ))
        ) : sortedReports?.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="font-medium" style={{ color: 'var(--text-muted)' }}>
              {lang === 'ar' ? 'لا توجد بلاغات' : 'No reports'}
            </p>
          </div>
        ) : (
          sortedReports?.map((report) => (
            <div key={report.id} className="card p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: '#ef4444' }}>
                  {report.reporterName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-sm" style={{ color: 'var(--text-main)' }}>{report.reporterName}</h3>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{report.reporterEmail}</p>
                    </div>
                    <div className="text-left shrink-0">
                      <span className="badge text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                        {report.issueType}
                      </span>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {new Date(report.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{report.description}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
