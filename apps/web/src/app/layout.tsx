import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import ErrorBoundary from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'Mr.H Academy',
  description: 'Online learning platform',
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
      <body className="antialiased min-h-screen dark-theme font-arabic">
        <Providers>
          <ErrorBoundary>{children}</ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
