import type { Metadata } from 'next';
import './globals.css';
import '@/styles/animations.css';
import '@/styles/components.css';
import '@/styles/layout.css';
import { Providers } from './providers';
import { cairo, plusJakartaSans } from '@/lib/fonts';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'Mr.H Academy', template: '%s | Mr.H Academy' },
  description: 'Learn languages with expert tutors online.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                var theme = localStorage.getItem('theme');
                var lang = localStorage.getItem('lang_pref');
                function applyBodyClasses() {
                  if (!document.body) return;
                  if (theme === 'light') {
                    document.body.classList.remove('dark-theme');
                  } else {
                    document.body.classList.add('dark-theme');
                  }
                  if (lang === 'en') {
                    document.body.classList.add('ltr');
                  } else {
                    document.body.classList.remove('ltr');
                  }
                }
                if (theme === 'light') {
                  document.documentElement.classList.remove('dark-theme');
                } else {
                  document.documentElement.classList.add('dark-theme');
                }
                if (lang === 'en') {
                  document.documentElement.setAttribute('lang', 'en');
                  document.documentElement.setAttribute('dir', 'ltr');
                } else {
                  document.documentElement.setAttribute('lang', 'ar');
                  document.documentElement.setAttribute('dir', 'rtl');
                }
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', applyBodyClasses, { once: true });
                } else {
                  applyBodyClasses();
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`antialiased min-h-screen dark-theme font-arabic ${cairo.variable} ${plusJakartaSans.variable}`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
