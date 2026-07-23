'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';

export default function Footer({ language }: { language?: 'ar' | 'en' } = {}) {
  const { lang } = useLanguage();
  const activeLanguage = language ?? lang;
  const isAr = activeLanguage === 'ar';
  const groups = [
    {
      title: isAr ? 'الأكاديمية' : 'Academy',
      links: [
        { label: isAr ? 'الدورات' : 'Courses', href: '/courses' },
        { label: isAr ? 'ابحث عن معلم' : 'Find a tutor', href: '/student/discover' },
        { label: isAr ? 'كن معلمًا' : 'Become a tutor', href: '/become-teacher' },
        { label: isAr ? 'تدريب المعلمين' : 'Tutor training', href: '/teacher-training' },
      ],
    },
    {
      title: isAr ? 'المساعدة' : 'Support',
      links: [
        { label: isAr ? 'مركز المساعدة' : 'Help center', href: '/help' },
        { label: isAr ? 'الأسئلة الشائعة' : 'FAQ', href: '/faq' },
        { label: isAr ? 'سياسة الخصوصية' : 'Privacy policy', href: '/privacy' },
        { label: isAr ? 'شروط الاستخدام' : 'Terms of use', href: '/terms' },
      ],
    },
  ];

  return (
    <footer className="academy-footer" lang={activeLanguage} dir={isAr ? 'rtl' : 'ltr'}>
      <div className="academy-footer-rule" aria-hidden="true"><span>MR.H ACADEMY</span><i /></div>
      <div className="academy-footer-inner">
        <div className="academy-footer-brand">
          <Link href={isAr ? '/' : '/en'} className="academy-brand">
            <span className="academy-crest academy-crest-light" aria-hidden="true"><b>H</b><small>ACADEMY</small></span>
            <span className="academy-wordmark"><strong>Mr.H</strong><small>{isAr ? 'أكاديمية اللغات' : 'LANGUAGE ACADEMY'}</small></span>
          </Link>
          <p>{isAr ? 'تعليم لغات شخصي يجمعك بمعلمين موثوقين، أينما كنت.' : 'Personal language learning with trusted tutors, wherever you are.'}</p>
          <Link href="/student/discover" className="academy-footer-cta">{isAr ? 'اكتشف معلمك' : 'Discover your tutor'} <span aria-hidden="true">↗</span></Link>
        </div>
        {groups.map((group) => (
          <nav key={group.title} aria-label={group.title} className="academy-footer-links">
            <h2>{group.title}</h2>
            {group.links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
          </nav>
        ))}
        <div className="academy-footer-note">
          <p>{isAr ? 'تعلّم بثقة' : 'Learn with confidence'}</p>
          <strong>{isAr ? 'كل جلسة تبدأ بهدف.' : 'Every lesson begins with a goal.'}</strong>
          <span>{isAr ? 'القاهرة • العالم' : 'Cairo • Worldwide'}</span>
        </div>
      </div>
      <div className="academy-footer-bottom">
        <p>© {new Date().getFullYear()} Mr.H Academy. {isAr ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}</p>
        <p>{isAr ? 'تعليم يصنع أثرًا' : 'Learning that moves you forward'}</p>
      </div>
    </footer>
  );
}
