'use client';

import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';

export default function AdminPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-slate-500 mt-1">Welcome back, {user?.firstName}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="btn-secondary px-4 py-2 text-sm">Home</Link>
            <button onClick={logout} className="btn-secondary px-4 py-2 text-sm border-red-200 text-red-600 hover:bg-red-50">
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 stagger-children">
          {/* Teachers Management */}
          <Link href="/admin/teachers" className="card p-8 hover:-translate-y-1 group">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-5 group-hover:bg-indigo-100 transition-colors">
              <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Tutor Management</h2>
            <p className="text-slate-500 text-sm leading-relaxed">Review, approve, or reject tutor applications. Manage all registered tutors.</p>
            <span className="link inline-flex items-center gap-1 mt-4 text-sm">
              Open panel
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </span>
          </Link>

          {/* Articles Management */}
          <Link href="/admin/articles" className="card p-8 hover:-translate-y-1 group">
            <div className="w-14 h-14 rounded-2xl bg-cyan-50 flex items-center justify-center mb-5 group-hover:bg-cyan-100 transition-colors">
              <svg className="w-7 h-7 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Articles Management</h2>
            <p className="text-slate-500 text-sm leading-relaxed">Create and publish training articles for tutors with Markdown support.</p>
            <span className="link inline-flex items-center gap-1 mt-4 text-sm">
              Open panel
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
