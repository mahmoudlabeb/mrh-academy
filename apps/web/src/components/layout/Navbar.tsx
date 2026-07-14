'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { useLanguage } from '@/contexts/language-context';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLanguage } = useLanguage();

  const isAr = lang === 'ar';

  const links = [
    {
      label: isAr ? 'الكورسات' : 'Courses',
      href: '/courses',
    },
    {
      label: isAr ? 'ابحث عن معلم' : 'Find a Teacher',
      href: '/student/discover',
    },
    {
      label: isAr ? 'كن معلمًا' : 'Become a Teacher',
      href: '/become-teacher',
    },
    {
      label: isAr ? 'التدريب' : 'Training',
      href: '/teacher-training',
    },
    {
      label: isAr ? 'المفردات' : 'Vocabulary',
      href: '/vocabulary',
    },
  ];

  const dashboardHref = user
    ? user.role === 'student'
      ? '/student'
      : user.role === 'tutor'
        ? '/tutor'
        : '/admin'
    : '/login';

  return (
    <nav className="fixed top-0 w-full z-50 navbar-dark animate-fade-in">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-2xl font-bold logo-font transition-all duration-300 group-hover:scale-105" style={{ color: '#D4A353' }}>
            Mr.H Academy
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="nav-link text-sm font-medium">
              {link.label}
            </Link>
          ))}
          <div className="flex items-center gap-2 me-4 pe-4 border-e border-[#1D535B]">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-colors hover:bg-[#1D535B]"
              style={{ color: '#FFFFF0' }}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              className="px-2 py-1 rounded-lg text-sm font-bold transition-colors hover:bg-[#1D535B]"
              style={{ color: '#D4A353' }}
              aria-label={isAr ? 'Switch to English' : 'Switch to Arabic'}
            >
              {isAr ? 'EN' : 'ع'}
            </button>

            {/* Auth */}
            {user ? (
              <>
                <NotificationBell />
                <Link
                  href={dashboardHref}
                  className="btn-ghost text-sm font-medium"
                  style={{ color: '#FFFFF0' }}
                >
                  {isAr ? 'لوحة التحكم' : 'Dashboard'}
                </Link>
                <button
                  onClick={logout}
                  className="btn-ghost text-sm font-medium"
                  style={{ color: '#FFFFF0' }}
                >
                  {isAr ? 'تسجيل الخروج' : 'Logout'}
                </button>
              </>
            ) : (
              <>
                <Link
                  href={isAr ? '/login' : '/en/login'}
                  className="btn-ghost text-sm font-medium"
                  style={{ color: '#FFFFF0' }}
                >
                  {isAr ? 'تسجيل الدخول' : 'Login'}
                </Link>
                <Link
                  href={isAr ? '/register' : '/en/register'}
                  className="btn-primary text-sm font-semibold animate-bounce-soft"
                >
                  {isAr ? 'اشتراك' : 'Register'}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          {/* Theme Toggle (Mobile) */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg transition-colors hover:bg-[#1D535B]"
            style={{ color: '#FFFFF0' }}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          {/* Language Toggle (Mobile) */}
          <button
            onClick={toggleLanguage}
            className="px-2 py-1 rounded-lg text-sm font-bold transition-colors hover:bg-[#1D535B]"
            style={{ color: '#D4A353' }}
            aria-label={isAr ? 'Switch to English' : 'Switch to Arabic'}
          >
            {isAr ? 'EN' : 'ع'}
          </button>
          <NotificationBell />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg"
            style={{ color: '#FFFFF0' }}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#1D535B]" style={{ background: '#1D535B' }}>
          <div className="px-4 py-4 space-y-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block nav-link text-sm font-medium py-2"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-[#1D535B] space-y-2">
              {user ? (
                <>
                  <Link
                    href={dashboardHref}
                    className="block text-sm font-medium py-2"
                    style={{ color: '#FFFFF0' }}
                    onClick={() => setMobileOpen(false)}
                  >
                    {isAr ? 'لوحة التحكم' : 'Dashboard'}
                  </Link>
                  <button
                    onClick={() => { logout(); setMobileOpen(false); }}
                    className="block w-full text-right text-sm font-medium py-2"
                    style={{ color: '#FFFFF0' }}
                  >
                    {isAr ? 'تسجيل الخروج' : 'Logout'}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href={isAr ? '/login' : '/en/login'}
                    className="block text-sm font-medium py-2"
                    style={{ color: '#FFFFF0' }}
                    onClick={() => setMobileOpen(false)}
                  >
                    {isAr ? 'تسجيل الدخول' : 'Login'}
                  </Link>
                  <Link
                    href={isAr ? '/register' : '/en/register'}
                    className="block text-center rounded-xl py-2.5 text-sm font-semibold transition-all hover:brightness-105"
                    style={{ background: 'linear-gradient(135deg, #F3E1B9, #B89754)', color: '#0F3A40' }}
                    onClick={() => setMobileOpen(false)}
                  >
                    {isAr ? 'اشتراك' : 'Register'}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
