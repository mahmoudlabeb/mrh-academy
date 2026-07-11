'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

type Review = {
  id: string;
  studentName: string;
  tutorName: string;
  rating: number;
  comment: string;
  isApproved: boolean;
  createdAt: string;
};

export default function ReviewsTab() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();

  const reviewsQuery = useQuery({
    queryKey: ['admin-reviews'],
    queryFn: async () => {
      const { data } = await apiClient.get<Review[]>('/admin/reviews');
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/admin/reviews/${id}/approve`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/reviews/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
    },
  });

  const pendingReviews = reviewsQuery.data?.filter((r) => !r.isApproved) ?? [];
  const approvedReviews = reviewsQuery.data?.filter((r) => r.isApproved) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--text-main)' }}>
          {lang === 'ar' ? 'تقييمات قيد المراجعة' : 'Pending Reviews'}
          {pendingReviews.length > 0 && (
            <span className="me-2 px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(234,179,8,0.1)', color: '#eab308' }}>{pendingReviews.length}</span>
          )}
        </h3>
        {pendingReviews.length === 0 ? (
          <div className="card p-8 text-center">
            <p style={{ color: 'var(--text-muted)' }}>{lang === 'ar' ? 'لا توجد تقييمات معلقة' : 'No pending reviews'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingReviews.map((review) => (
              <div key={review.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm" style={{ color: 'var(--text-main)' }}>{review.studentName}</h4>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{lang === 'ar' ? 'على' : 'on'} {review.tutorName}</span>
                    </div>
                    <div className="flex items-center gap-0.5 mb-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg key={i} className="w-4 h-4" fill={i < review.rating ? '#D4A353' : 'none'} viewBox="0 0 24 24" stroke="#D4A353" strokeWidth={i < review.rating ? 0 : 1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{review.comment}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {new Date(review.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => approveMutation.mutate(review.id)}
                      disabled={approveMutation.isPending}
                      className="btn-primary px-4 py-2 text-xs"
                    >
                      {lang === 'ar' ? 'اعتماد' : 'Approve'}
                    </button>
                    <button
                      onClick={() => rejectMutation.mutate(review.id)}
                      disabled={rejectMutation.isPending}
                      className="btn-secondary px-4 py-2 text-xs"
                      style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}
                    >
                      {lang === 'ar' ? 'رفض' : 'Reject'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--text-main)' }}>
          {lang === 'ar' ? 'التقييمات المعتمدة' : 'Approved Reviews'}
        </h3>
        {approvedReviews.length === 0 ? (
          <div className="card p-8 text-center">
            <p style={{ color: 'var(--text-muted)' }}>{lang === 'ar' ? 'لا توجد تقييمات معتمدة' : 'No approved reviews'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {approvedReviews.map((review) => (
              <div key={review.id} className="card-dark p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm" style={{ color: 'var(--text-main)' }}>{review.studentName}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{lang === 'ar' ? 'على' : 'on'} {review.tutorName}</span>
                  <div className="flex items-center gap-0.5 me-auto">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} className="w-3 h-3" fill={i < review.rating ? '#D4A353' : 'none'} viewBox="0 0 24 24" stroke="#D4A353" strokeWidth={i < review.rating ? 0 : 1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                    ))}
                  </div>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{review.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
