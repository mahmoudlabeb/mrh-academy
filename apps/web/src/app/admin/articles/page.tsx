'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';

type Article = {
  id: string;
  title: string;
  content: string;
  coverImageUrl?: string;
  isPublished: boolean;
  createdAt: string;
  author?: { firstName: string; lastName: string };
};

export default function AdminArticlesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Article | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { data: articles = [] } = useQuery({
    queryKey: ['articles'],
    queryFn: async () => {
      const { data } = await apiClient.get<Article[]>('/teacher-training/articles/all');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (articleData: { title: string; content: string; isPublished: boolean }) => {
      const { data } = await apiClient.post('/teacher-training/articles', articleData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...articleData }: { id: string; title: string; content: string; isPublished: boolean }) => {
      const { data } = await apiClient.put(`/teacher-training/articles/${id}`, articleData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/teacher-training/articles/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });

  const resetForm = () => {
    setEditing(null);
    setTitle('');
    setContent('');
    setIsPublished(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, title, content, isPublished });
    } else {
      await createMutation.mutateAsync({ title, content, isPublished });
    }
  };

  const handleEdit = (article: Article) => {
    setEditing(article);
    setTitle(article.title);
    setContent(article.content);
    setIsPublished(article.isPublished);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this article?')) return;
    await deleteMutation.mutateAsync(id);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <div className="dashboard-header">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: '#FFFFF0' }}>إدارة المقالات</h1>
              <p className="mt-1" style={{ color: '#E4CC9C' }}>إنشاء وإدارة مقالات تدريب المعلمين</p>
            </div>
            <Link href="/admin" className="btn-secondary px-4 py-2 text-sm" style={{ borderColor: '#1D535B', color: '#FFFFF0' }}>لوحة التحكم</Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="card p-6 mb-8 animate-scale-in">
          <h2 className="text-xl font-bold mb-5" style={{ color: 'var(--text-main)' }}>{editing ? 'تعديل المقال' : 'مقال جديد'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              placeholder="عنوان المقال"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field text-lg font-medium"
              required
            />
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>المحتوى (Markdown)</label>
                <button type="button" onClick={() => setShowPreview(!showPreview)} className="link text-xs">
                  {showPreview ? '✏️ تعديل' : '👁️ معاينة'}
                </button>
              </div>
              {showPreview ? (
                <div className="prose prose-sm max-w-none rounded-xl p-5 min-h-[250px]" style={{ border: '1px solid var(--border-color)', background: 'var(--bg-light)' }}>
                  <ReactMarkdown>{content}</ReactMarkdown>
                </div>
              ) : (
                <textarea
                  placeholder="اكتب محتوى المقال باستخدام Markdown..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="input-field min-h-[250px] font-mono text-sm resize-y"
                  required
                />
              )}
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="w-10 h-5 rounded-full transition-colors relative" style={{ background: isPublished ? '#D4A353' : 'var(--border-color)' }}>
                <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="sr-only" />
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isPublished ? 'translate-x-5' : ''}`} />
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>منشور</span>
            </label>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {editing ? 'جاري التحديث...' : 'جاري الإنشاء...'}
                  </span>
                ) : (
                  editing ? 'تحديث المقال' : 'إنشاء المقال'
                )}
              </button>
              {editing && (
                <button type="button" onClick={resetForm} className="btn-secondary" disabled={createMutation.isPending || updateMutation.isPending}>
                  إلغاء
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="space-y-3">
          {articles.length === 0 && (
            <div className="card p-12 text-center">
              <p className="font-medium" style={{ color: 'var(--text-muted)' }}>لا توجد مقالات بعد</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>أنشئ مقالك الأول أعلاه</p>
            </div>
          )}
          {articles.map((article) => (
            <div key={article.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate" style={{ color: 'var(--text-main)' }}>{article.title}</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {article.author?.firstName} {article.author?.lastName} &middot;{' '}
                    {new Date(article.createdAt).toLocaleDateString('ar-EG')}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="badge text-xs font-medium" style={article.isPublished ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' } : { background: 'var(--bg-light)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                    {article.isPublished ? 'منشور' : 'مسودة'}
                  </span>
                  <button onClick={() => handleEdit(article)} className="link text-xs">تعديل</button>
                  <button onClick={() => handleDelete(article.id)} className="text-xs font-medium transition-colors" style={{ color: '#ef4444' }}>حذف</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
