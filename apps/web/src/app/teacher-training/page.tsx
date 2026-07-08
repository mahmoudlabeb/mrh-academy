'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';

type Article = {
  id: string;
  title: string;
  content: string;
  coverImageUrl?: string;
  createdAt: string;
  author?: { firstName: string; lastName: string };
};

export default function TeacherTrainingPage() {
  const [selected, setSelected] = useState<Article | null>(null);
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['teacher-training-articles'],
    queryFn: async () => {
      const { data } = await apiClient.get<Article[]>('/teacher-training/articles');
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="text-center">
          <svg className="w-8 h-8 animate-spin mx-auto mb-3" viewBox="0 0 24 24" fill="none" style={{ color: '#D4A353' }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p style={{ color: 'var(--text-muted)' }}>جاري تحميل المقالات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <div className="dashboard-header">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: '#FFFFF0' }}>تدريب المعلمين</h1>
              <p className="mt-1" style={{ color: '#E4CC9C' }}>مقالات وموارد لتحسين مهاراتك التدريسية</p>
            </div>
            <Link href="/" className="btn-secondary px-4 py-2 text-sm" style={{ borderColor: '#1D535B', color: '#FFFFF0' }}>الرئيسية</Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {selected ? (
          <article className="card p-8 animate-scale-in">
            <button onClick={() => setSelected(null)} className="link inline-flex items-center gap-1 mb-6">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              العودة إلى المقالات
            </button>
            <h2 className="text-3xl font-bold mb-3" style={{ color: 'var(--text-main)' }}>{selected.title}</h2>
            <div className="flex items-center gap-2 text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: '#D4A353' }}>
                {selected.author?.firstName?.[0] || 'م'}
              </div>
              <span>{selected.author?.firstName} {selected.author?.lastName}</span>
              <span>&middot;</span>
              <span>{new Date(selected.createdAt).toLocaleDateString('ar-EG')}</span>
            </div>
            <div className="prose prose-sm max-w-none" style={{ color: 'var(--text-main)' }}>
              <ReactMarkdown>{selected.content}</ReactMarkdown>
            </div>
          </article>
        ) : (
          <div className="space-y-3 stagger-children">
            {articles.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--bg-light)' }}>
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <p className="font-medium" style={{ color: 'var(--text-muted)' }}>لم يتم نشر مقالات بعد</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>تحقق مرة أخرى قريبًا للحصول على موارد تدريبية جديدة</p>
              </div>
            ) : (
              articles.map((article) => (
                <button
                  key={article.id}
                  onClick={() => setSelected(article)}
                  className="w-full text-right card p-5 cursor-pointer"
                >
                  <h3 className="font-semibold text-lg" style={{ color: 'var(--text-main)' }}>{article.title}</h3>
                  <p className="text-sm mt-2 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                    <span>{article.author?.firstName} {article.author?.lastName}</span>
                    <span>&middot;</span>
                    <span>{new Date(article.createdAt).toLocaleDateString('ar-EG')}</span>
                  </p>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
