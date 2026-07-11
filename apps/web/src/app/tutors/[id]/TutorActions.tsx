'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/auth-context';

export default function TutorActions({ tutorId }: { tutorId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: favoriteTutors = [] } = useQuery({
    queryKey: ['favorite-tutors'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ userId: string }[]>('/students/favorite-tutors');
      return data;
    },
    enabled: !!user && user.role === 'student',
  });

  const isFavorite = favoriteTutors.some((t) => t.userId === tutorId);

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      if (isFavorite) {
        await apiClient.delete(`/students/favorites/${tutorId}`);
      } else {
        await apiClient.post('/students/favorites', { tutorId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-tutors'] });
    },
  });

  const handleSendMessage = () => {
    router.push(`/student?tab=messages&with=${tutorId}`);
  };

  return (
    <>
      <button
        onClick={handleSendMessage}
        className="flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold rounded-xl transition-all"
        style={{ border: '1px solid var(--border-color)', color: 'var(--text-main)', background: 'var(--bg-light)' }}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        أرسل رسالة
      </button>

      <button
        onClick={() => favoriteMutation.mutate()}
        disabled={favoriteMutation.isPending}
        className="flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold rounded-xl transition-all"
        style={{ border: '1px solid var(--border-color)', color: 'var(--text-main)', background: 'var(--bg-light)' }}
      >
        <svg className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        {isFavorite ? 'إزالة من المفضلة' : 'أضف للمفضلة'}
      </button>
    </>
  );
}