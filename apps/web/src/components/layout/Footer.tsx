"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/language-context";

export default function Footer({ language }: { language?: "ar" | "en" } = {}) {
  const { lang } = useLanguage();
  const activeLanguage = language ?? lang;
  const isAr = activeLanguage === "ar";
  const base = `/${activeLanguage}`;
  const localize = (path: string) => `${base}${path}`;

  const groups = [
    {
      title: isAr ? "تعلّم" : "Learn",
      links: [
        {
          label: isAr ? "مدرّسو الإنجليزية" : "English tutors",
          href: `${localize("/tutors")}?language=English`,
        },
        {
          label: isAr ? "مدرّسو العربية" : "Arabic tutors",
          href: `${localize("/tutors")}?language=Arabic`,
        },
        { label: isAr ? "الدورات" : "Courses", href: localize("/courses") },
      ],
    },
    {
      title: isAr ? "للطلاب" : "For students",
      links: [
        { label: isAr ? "كيف تعمل المنصة" : "How it works", href: base },
        {
          label: isAr ? "الأسئلة الشائعة" : "FAQs",
          href: "/faq",
        },
        {
          label: isAr ? "مركز المساعدة" : "Help center",
          href: localize("/help"),
        },
      ],
    },
    {
      title: isAr ? "عن أكاديمية Mr.H" : "About Mr.H Academy",
      links: [
        {
          label: isAr ? "كن مدرّسًا" : "Become a tutor",
          href: localize("/become-a-tutor"),
        },
        {
          label: isAr ? "موارد المعلّمين" : "Teaching resources",
          href: localize("/resources"),
        },
        {
          label: isAr ? "تدريب الشركات" : "Corporate training",
          href: "/corporate-training",
        },
      ],
    },
  ];

  return (
    <footer
      className="academy-footer"
      lang={activeLanguage}
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="academy-footer-inner">
        <div className="academy-footer-brand">
          <Link href={base} className="academy-brand">
            <span className="academy-wordmark">
              <strong>Mr.H Academy</strong>
            </span>
          </Link>
          <p>
            {isAr
              ? "منصتك لتعلّم اللغات عبر الإنترنت مع مدرّسين محترفين من مختلف أنحاء العالم."
              : "Your complete platform for learning languages online with professional tutors from around the world."}
          </p>
          <div className="academy-socials" aria-label="Social media">
            <a href="https://facebook.com" aria-label="Facebook">
              f
            </a>
            <a href="https://x.com" aria-label="X">
              x
            </a>
            <a href="https://instagram.com" aria-label="Instagram">
              ◎
            </a>
            <a href="https://youtube.com" aria-label="YouTube">
              ▶
            </a>
          </div>
        </div>

        {groups.map((group) => (
          <nav
            key={group.title}
            aria-label={group.title}
            className="academy-footer-links"
          >
            <h2>{group.title}</h2>
            {group.links.map((link) => (
              <Link key={`${link.href}-${link.label}`} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        ))}
      </div>

      <div className="academy-footer-bottom">
        <p>
          © {new Date().getFullYear()} Mr.H Academy.{" "}
          {isAr ? "جميع الحقوق محفوظة." : "All rights reserved."}
        </p>
        <div>
          <Link href={localize("/privacy")}>
            {isAr ? "سياسة الخصوصية" : "Privacy policy"}
          </Link>
          <Link href={localize("/terms")}>
            {isAr ? "شروط الخدمة" : "Terms of service"}
          </Link>
        </div>
      </div>
    </footer>
  );
}
