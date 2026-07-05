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
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Articles Management</h1>
              <p className="text-slate-500 mt-1">Create and manage teacher training articles</p>
            </div>
            <Link href="/admin" className="btn-secondary px-4 py-2 text-sm">Dashboard</Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Form */}
        <div className="card p-6 mb-8 animate-scale-in">
          <h2 className="text-xl font-bold text-slate-900 mb-5">{editing ? 'Edit Article' : 'New Article'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              placeholder="Article title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field text-lg font-medium"
              required
            />
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-slate-700">Content (Markdown)</label>
                <button type="button" onClick={() => setShowPreview(!showPreview)} className="link text-xs">
                  {showPreview ? '✏️ Edit' : '👁️ Preview'}
                </button>
              </div>
              {showPreview ? (
                <div className="prose prose-sm max-w-none rounded-xl border border-slate-200 p-5 min-h-[250px] bg-slate-50">
                  <ReactMarkdown>{content}</ReactMarkdown>
                </div>
              ) : (
                <textarea
                  placeholder="Write your article content in Markdown..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="input-field min-h-[250px] font-mono text-sm resize-y"
                  required
                />
              )}
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`w-10 h-5 rounded-full transition-colors relative ${isPublished ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="sr-only" />
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isPublished ? 'translate-x-5' : ''}`} />
              </div>
              <span className="text-sm font-medium text-slate-700">Published</span>
            </label>
            <div className="flex gap-3 pt-2">
              <button 
                type="submit" 
                className="btn-primary"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {editing ? 'Updating...' : 'Creating...'}
                  </span>
                ) : (
                  editing ? 'Update Article' : 'Create Article'
                )}
              </button>
              {editing && (
                <button type="button" onClick={resetForm} className="btn-secondary" disabled={createMutation.isPending || updateMutation.isPending}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Articles List */}
        <div className="space-y-3">
          {articles.length === 0 && (
            <div className="card p-12 text-center">
              <p className="text-slate-500 font-medium">No articles yet</p>
              <p className="text-slate-400 text-sm mt-1">Create your first article above</p>
            </div>
          )}
          {articles.map((article) => (
            <div key={article.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">{article.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {article.author?.firstName} {article.author?.lastName} &middot;{' '}
                    {new Date(article.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`badge text-xs font-medium ${
                    article.isPublished ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}>
                    {article.isPublished ? 'Published' : 'Draft'}
                  </span>
                  <button onClick={() => handleEdit(article)} className="link text-xs">Edit</button>
                  <button onClick={() => handleDelete(article.id)} className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
