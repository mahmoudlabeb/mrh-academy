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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-slate-500">Loading articles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Teacher Training</h1>
              <p className="text-slate-500 mt-1">Articles and resources to improve your teaching skills</p>
            </div>
            <Link href="/" className="btn-secondary px-4 py-2 text-sm">Home</Link>
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
              Back to articles
            </button>
            <h2 className="text-3xl font-bold text-slate-900 mb-3">{selected.title}</h2>
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-8">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white text-xs font-bold">
                {selected.author?.firstName?.[0] || 'A'}
              </div>
              <span>{selected.author?.firstName} {selected.author?.lastName}</span>
              <span>&middot;</span>
              <span>{new Date(selected.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-600 prose-a:text-indigo-600">
              <ReactMarkdown>{selected.content}</ReactMarkdown>
            </div>
          </article>
        ) : (
          <div className="space-y-3 stagger-children">
            {articles.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <p className="text-slate-500 font-medium">No articles published yet</p>
                <p className="text-slate-400 text-sm mt-1">Check back soon for new training resources</p>
              </div>
            ) : (
              articles.map((article) => (
                <button
                  key={article.id}
                  onClick={() => setSelected(article)}
                  className="w-full text-left card p-5 hover:-translate-y-0.5 cursor-pointer"
                >
                  <h3 className="font-semibold text-lg text-slate-900">{article.title}</h3>
                  <p className="text-sm text-slate-400 mt-2 flex items-center gap-2">
                    <span>{article.author?.firstName} {article.author?.lastName}</span>
                    <span>&middot;</span>
                    <span>{new Date(article.createdAt).toLocaleDateString()}</span>
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
