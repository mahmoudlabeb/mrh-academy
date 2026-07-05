'use client';

import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';

export default function StudentPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Student Dashboard</h1>
            <p className="text-slate-500 mt-1">Welcome back, {user?.firstName}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="btn-secondary px-4 py-2 text-sm">Home</Link>
            <button onClick={logout} className="btn-secondary px-4 py-2 text-sm border-red-200 text-red-600 hover:bg-red-50">Logout</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
          <Link href="/student/discover" className="card p-8 hover:-translate-y-1 group">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-5 group-hover:bg-indigo-100 transition-colors">
              <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Discover Tutors</h2>
            <p className="text-slate-500 text-sm leading-relaxed">Search, filter, and find the perfect tutor for your learning goals.</p>
            <span className="link inline-flex items-center gap-1 mt-4 text-sm">Find a tutor <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></span>
          </Link>

          <Link href="/student/profile" className="card p-8 hover:-translate-y-1 group">
            <div className="w-14 h-14 rounded-2xl bg-cyan-50 flex items-center justify-center mb-5 group-hover:bg-cyan-100 transition-colors">
              <svg className="w-7 h-7 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">My Profile</h2>
            <p className="text-slate-500 text-sm leading-relaxed">Manage your account, change password, and update personal info.</p>
            <span className="link inline-flex items-center gap-1 mt-4 text-sm">Edit profile <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></span>
          </Link>

          <Link href="/become-teacher" className="card p-8 hover:-translate-y-1 group">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-5 group-hover:bg-emerald-100 transition-colors">
              <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Become a Tutor</h2>
            <p className="text-slate-500 text-sm leading-relaxed">Apply to share your expertise and start teaching on our platform.</p>
            <span className="link inline-flex items-center gap-1 mt-4 text-sm">Apply now <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></span>
          </Link>
        </div>
      </div>
    </div>
  );
}
