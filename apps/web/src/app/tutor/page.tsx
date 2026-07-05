'use client';

import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';

export default function TutorPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Tutor Dashboard</h1>
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
          <Link href="/tutor/availability" className="card p-8 hover:-translate-y-1 group">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-5 group-hover:bg-indigo-100 transition-colors">
              <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Availability</h2>
            <p className="text-slate-500 text-sm leading-relaxed">Set your teaching hours with our interactive calendar scheduler.</p>
            <span className="link inline-flex items-center gap-1 mt-4 text-sm">Manage schedule <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></span>
          </Link>

          <Link href="/tutor/profile" className="card p-8 hover:-translate-y-1 group">
            <div className="w-14 h-14 rounded-2xl bg-cyan-50 flex items-center justify-center mb-5 group-hover:bg-cyan-100 transition-colors">
              <svg className="w-7 h-7 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">My Profile</h2>
            <p className="text-slate-500 text-sm leading-relaxed">Update your personal information, avatar, and account settings.</p>
            <span className="link inline-flex items-center gap-1 mt-4 text-sm">Edit profile <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></span>
          </Link>

          <Link href="/teacher-training" className="card p-8 hover:-translate-y-1 group">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-5 group-hover:bg-emerald-100 transition-colors">
              <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Teacher Training</h2>
            <p className="text-slate-500 text-sm leading-relaxed">Browse articles and resources to improve your teaching skills.</p>
            <span className="link inline-flex items-center gap-1 mt-4 text-sm">Browse resources <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></span>
          </Link>
        </div>
      </div>
    </div>
  );
}
