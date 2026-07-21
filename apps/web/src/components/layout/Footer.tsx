'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';

export default function Footer() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  return (
    <footer className="footer-dark py-12 animate-fade-in">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Logo & About */}
          <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <span className="text-xl font-bold logo-font transition-all duration-300 hover:scale-105 inline-block" style={{ color: '#D4A353' }}>
              Mr.H Academy
            </span>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: '#E4CC9C' }}>
              {isAr ? 'منصة تعليم اللغات عبر الإنترنت. تواصل مع معلمين معتمدين واحجز جلسات فردية.' : 'Online language learning with certified tutors and personalized one-to-one lessons.'}
            </p>
          </div>

          {/* Quick Links */}
          <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <h4 className="text-sm font-semibold mb-4" style={{ color: '#FFFFF0' }}>{isAr ? 'روابط سريعة' : 'Quick links'}</h4>
            <ul className="space-y-2.5">
              <li><Link href="/courses" className="text-sm transition-all hover:translate-x-1 inline-block" style={{ color: '#E4CC9C' }} onMouseEnter={e => e.currentTarget.style.color = '#D4A353'} onMouseLeave={e => e.currentTarget.style.color = '#E4CC9C'}>{isAr ? 'الدورات' : 'Courses'}</Link></li>
              <li><Link href="/student/discover" className="text-sm transition-all hover:translate-x-1 inline-block" style={{ color: '#E4CC9C' }} onMouseEnter={e => e.currentTarget.style.color = '#D4A353'} onMouseLeave={e => e.currentTarget.style.color = '#E4CC9C'}>{isAr ? 'ابحث عن معلم' : 'Find a Teacher'}</Link></li>
              <li><Link href="/become-teacher" className="text-sm transition-all hover:translate-x-1 inline-block" style={{ color: '#E4CC9C' }} onMouseEnter={e => e.currentTarget.style.color = '#D4A353'} onMouseLeave={e => e.currentTarget.style.color = '#E4CC9C'}>{isAr ? 'كن معلماً' : 'Become a Teacher'}</Link></li>
              <li><Link href="/teacher-training" className="text-sm transition-all hover:translate-x-1 inline-block" style={{ color: '#E4CC9C' }} onMouseEnter={e => e.currentTarget.style.color = '#D4A353'} onMouseLeave={e => e.currentTarget.style.color = '#E4CC9C'}>{isAr ? 'التدريب' : 'Training'}</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <h4 className="text-sm font-semibold mb-4" style={{ color: '#FFFFF0' }}>{isAr ? 'الدعم' : 'Support'}</h4>
            <ul className="space-y-2.5">
              <li><Link href="/help" className="text-sm transition-all hover:translate-x-1 inline-block" style={{ color: '#E4CC9C' }} onMouseEnter={e => e.currentTarget.style.color = '#D4A353'} onMouseLeave={e => e.currentTarget.style.color = '#E4CC9C'}>{isAr ? 'مركز المساعدة' : 'Help Center'}</Link></li>
              <li><Link href="/faq" className="text-sm transition-all hover:translate-x-1 inline-block" style={{ color: '#E4CC9C' }} onMouseEnter={e => e.currentTarget.style.color = '#D4A353'} onMouseLeave={e => e.currentTarget.style.color = '#E4CC9C'}>{isAr ? 'الأسئلة الشائعة' : 'FAQ'}</Link></li>
              <li><Link href="/privacy" className="text-sm transition-all hover:translate-x-1 inline-block" style={{ color: '#E4CC9C' }} onMouseEnter={e => e.currentTarget.style.color = '#D4A353'} onMouseLeave={e => e.currentTarget.style.color = '#E4CC9C'}>{isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}</Link></li>
              <li><Link href="/terms" className="text-sm transition-all hover:translate-x-1 inline-block" style={{ color: '#E4CC9C' }} onMouseEnter={e => e.currentTarget.style.color = '#D4A353'} onMouseLeave={e => e.currentTarget.style.color = '#E4CC9C'}>{isAr ? 'شروط الاستخدام' : 'Terms of Use'}</Link></li>
            </ul>
          </div>

          {/* Social */}
          <div className="animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <h4 className="text-sm font-semibold mb-4" style={{ color: '#FFFFF0' }}>{isAr ? 'تواصل معنا' : 'Connect with us'}</h4>
            <div className="flex gap-3">
              <a href="#" className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-all hover:scale-110 hover:shadow-lg" style={{ background: '#1D535B', color: '#E4CC9C', border: '1px solid #1D535B' }}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/></svg>
              </a>
              <a href="#" className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-all hover:scale-110 hover:shadow-lg" style={{ background: '#1D535B', color: '#E4CC9C', border: '1px solid #1D535B' }}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"/></svg>
              </a>
              <a href="#" className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-all hover:scale-110 hover:shadow-lg" style={{ background: '#1D535B', color: '#E4CC9C', border: '1px solid #1D535B' }}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.237 2.636 7.855 6.356 9.312-.088-.791-.167-2.005.035-2.868.181-.78 1.172-4.97 1.172-4.97s-.299-.6-.299-1.486c0-1.39.806-2.428 1.81-2.428.852 0 1.264.64 1.264 1.408 0 .858-.546 2.14-.828 3.33-.236.995.5 1.807 1.48 1.807 1.776 0 3.143-2.18 3.143-4.712 0-2.464-1.66-4.31-4.68-4.31-3.412 0-5.428 2.546-5.428 5.39 0 .98.323 1.864.825 2.556.092.112.106.21.078.322-.084.352-.272 1.11-.31 1.265-.05.204-.164.247-.378.149-1.41-.574-2.065-2.116-2.065-3.85 0-2.861 2.415-6.294 7.2-6.294 3.85 0 6.38 2.786 6.38 5.78 0 3.96-2.202 6.92-5.45 6.92-1.09 0-2.116-.59-2.468-1.26l-.667 2.64c-.2.73-.62 1.46-1.152 2.03 1.048.29 2.18.44 3.37.44 5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
              </a>
              <a href="#" className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-all hover:scale-110 hover:shadow-lg" style={{ background: '#1D535B', color: '#E4CC9C', border: '1px solid #1D535B' }}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.66-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.41-.88.03-.24.36-.48.99-.74 3.9-1.7 6.5-2.82 7.8-3.36 3.71-1.53 4.48-1.8 4.98-1.81.11 0 .36.03.52.17.14.12.18.28.2.45-.02.08-.01.26-.02.42z"/></svg>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[#1D535B] text-center">
          <p className="text-sm" style={{ color: '#E4CC9C' }}>
            &copy; {new Date().getFullYear()} Mr.H Academy. {isAr ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
          </p>
        </div>
      </div>
    </footer>
  );
}
