'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled ? 'glass shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
            H
          </div>
          <span className="font-bold text-xl gradient-text">Mr.H Academy</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="btn-secondary px-4 py-2 text-sm">
            Log in
          </Link>
          <Link href="/register" className="btn-primary px-5 py-2 text-sm">
            Sign up
          </Link>
        </div>
      </div>
    </nav>
  );
}

function FloatingShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-400/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-400/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
      <div className="absolute top-1/3 right-1/3 w-48 h-48 bg-purple-400/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />
      <div className="absolute -top-10 -right-10 w-40 h-40 border border-indigo-200/30 rounded-full" />
      <div className="absolute -bottom-10 -left-10 w-60 h-60 border border-cyan-200/30 rounded-full" />
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="relative overflow-hidden">
        <FloatingShapes />

        {/* Hero */}
        <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 mb-8 animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              Now accepting tutor applications
            </div>

            <h1 className="mx-auto max-w-5xl text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 leading-[1.1]">
              Master any language with{' '}
              <span className="gradient-text">expert tutors</span>
              <br />
              from around the world
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-500 leading-relaxed">
              Connect with certified language tutors, book 1-on-1 sessions, and
              accelerate your learning journey with personalized guidance.
            </p>

            <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
              <Link href="/student/discover" className="btn-primary text-base px-8 py-3.5 group">
                Find a Tutor
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
              <Link href="/become-teacher" className="btn-secondary text-base px-8 py-3.5">
                Become a Teacher
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
              {[
                { label: 'Active Tutors', value: '200+' },
                { label: 'Languages', value: '12+' },
                { label: 'Students', value: '5,000+' },
                { label: 'Avg. Rating', value: '4.8 ★' },
              ].map((stat, i) => (
                <div key={stat.label} className="text-center animate-slide-up" style={{ animationDelay: `${0.2 + i * 0.1}s` }}>
                  <p className="text-2xl sm:text-3xl font-bold gradient-text">{stat.value}</p>
                  <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 bg-white/50">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
                Everything you need to succeed
              </h2>
              <p className="mt-4 text-lg text-slate-500">
                A complete platform for learning and teaching
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger-children">
              {[
                {
                  icon: (
                    <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  ),
                  title: 'Secure Authentication',
                  desc: 'Advanced session locking prevents account sharing. Log in securely with email or Google.',
                  color: 'from-indigo-500 to-indigo-600',
                  bgColor: 'bg-indigo-50',
                },
                {
                  icon: (
                    <svg className="w-6 h-6 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                  ),
                  title: 'Discovery Engine',
                  desc: 'Filter through hundreds of approved tutors based on language, price, and top ratings.',
                  color: 'from-cyan-500 to-cyan-600',
                  bgColor: 'bg-cyan-50',
                },
                {
                  icon: (
                    <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                    </svg>
                  ),
                  title: 'Tutor Training',
                  desc: 'Access a library of articles and resources designed to help tutors improve their teaching skills.',
                  color: 'from-purple-500 to-purple-600',
                  bgColor: 'bg-purple-50',
                },
                {
                  icon: (
                    <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                    </svg>
                  ),
                  title: 'Smart Scheduling',
                  desc: 'Interactive calendar system for tutors with anti-overlap protection and recurring slots.',
                  color: 'from-emerald-500 to-emerald-600',
                  bgColor: 'bg-emerald-50',
                },
                {
                  icon: (
                    <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                  ),
                  title: 'Reviews & Ratings',
                  desc: 'Transparent feedback system with detailed reviews from verified students.',
                  color: 'from-amber-500 to-amber-600',
                  bgColor: 'bg-amber-50',
                },
                {
                  icon: (
                    <svg className="w-6 h-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                  ),
                  title: 'Admin Moderation',
                  desc: 'Full admin panel for tutor application review, article management, and platform oversight.',
                  color: 'from-rose-500 to-rose-600',
                  bgColor: 'bg-rose-50',
                },
              ].map((feature, i) => (
                <div
                  key={feature.title}
                  className="card p-8 hover:-translate-y-1"
                >
                  <div className={`w-12 h-12 rounded-xl ${feature.bgColor} flex items-center justify-center mb-5`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <div className="rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-cyan-700 p-12 sm:p-16 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
              <div className="relative z-10">
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                  Ready to start your journey?
                </h2>
                <p className="text-indigo-200 text-lg mb-8 max-w-lg mx-auto">
                  Join thousands of students and tutors already on the platform.
                </p>
                <div className="flex items-center justify-center gap-4 flex-wrap">
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-indigo-700 transition-all hover:bg-indigo-50 hover:shadow-lg"
                  >
                    Get Started Free
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                  <Link
                    href="/teacher-training"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-white/10"
                  >
                    Teacher Resources
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-12">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
                  H
                </div>
                <span className="font-bold gradient-text">Mr.H Academy</span>
              </div>
              <p className="text-sm text-slate-400">
                &copy; {new Date().getFullYear()} Mr.H Academy. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
