import type { Metadata } from "next";
import "./globals.css";
import "@/styles/animations.css";
import "@/styles/layout.css";
import "@/styles/components.css";
import { Providers } from "./providers";
import { fontVariables } from "@/lib/fonts";
import { headers } from "next/headers";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: { default: "Mr.H Academy", template: "%s | Mr.H Academy" },
  description: "Learn languages with expert tutors online.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  const locale = requestHeaders.get("x-mrh-locale") === "en" ? "en" : "ar";
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={direction} suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                var theme = localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
                var lang = ${JSON.stringify(locale)};
                function applyBodyClasses() {
                  if (!document.body) return;
                if (theme === 'dark') {
                  document.body.classList.add('dark-theme');
                } else {
                  document.body.classList.remove('dark-theme');
                  }
                  if (lang === 'en') {
                    document.body.classList.add('ltr');
                  } else {
                    document.body.classList.remove('ltr');
                  }
                }
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark-theme');
                } else {
                  document.documentElement.classList.remove('dark-theme');
                }
                document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
                if (lang === 'en') {
                  document.documentElement.setAttribute('lang', 'en');
                  document.documentElement.setAttribute('dir', 'ltr');
                } else {
                  document.documentElement.setAttribute('lang', 'ar');
                  document.documentElement.setAttribute('dir', 'rtl');
                }
                document.documentElement.dataset.language = lang === 'en' ? 'en' : 'ar';
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
      <body
        suppressHydrationWarning
        className={`antialiased min-h-screen ${fontVariables}`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
