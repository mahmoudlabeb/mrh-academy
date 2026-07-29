"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/language-context";
import { DirectionalArrow } from "@/components/shared/DirectionalArrow";

export default function Footer({ language }: { language?: "ar" | "en" } = {}) {
  const { lang } = useLanguage();
  const activeLanguage = language ?? lang;
  const isAr = activeLanguage === "ar";
  const base = `/${activeLanguage}`;
  const localize = (path: string) => `${base}${path}`;
  const groups = [
    {
      title: isAr ? "الأكاديمية" : "Academy",
      links: [
        { label: isAr ? "الدورات" : "Courses", href: localize("/courses") },
        {
          label: isAr ? "ابحث عن معلّم" : "Find a tutor",
          href: localize("/tutors"),
        },
        {
          label: isAr ? "انضم كمدرّس" : "Become a tutor",
          href: localize("/become-a-tutor"),
        },
        {
          label: isAr ? "موارد المعلّمين" : "Teaching resources",
          href: localize("/resources"),
        },
      ],
    },
    {
      title: isAr ? "المساعدة" : "Support",
      links: [
        {
          label: isAr ? "مركز المساعدة" : "Help center",
          href: localize("/help"),
        },
        {
          label: isAr ? "سياسة الخصوصية" : "Privacy policy",
          href: localize("/privacy"),
        },
        {
          label: isAr ? "شروط الاستخدام" : "Terms of use",
          href: localize("/terms"),
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
      <div className="academy-footer-rule" aria-hidden="true">
        <span>MRH ACADEMY</span>
        <i />
      </div>
      <div className="academy-footer-inner">
        <div className="academy-footer-brand">
          <Link href={base} className="academy-brand">
            <span
              className="academy-crest academy-crest-light"
              aria-hidden="true"
            >
              <b>M</b>
            </span>
            <span className="academy-wordmark">
              <strong>MRH Academy</strong>
            </span>
          </Link>
          <p>
            {isAr
              ? "تعلّم اللغات مع معلّمين معتمدين داخل تجربة آمنة ومتكاملة."
              : "Personal language learning with approved tutors in a secure, complete experience."}
          </p>
          <Link href={localize("/tutors")} className="academy-footer-cta">
            {isAr ? "اكتشف معلّمك" : "Discover your tutor"}{" "}
            <DirectionalArrow diagonal />
          </Link>
        </div>
        {groups.map((group) => (
          <nav
            key={group.title}
            aria-label={group.title}
            className="academy-footer-links"
          >
            <h2>{group.title}</h2>
            {group.links.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        ))}
        <div className="academy-footer-note">
          <p>{isAr ? "تعلّم بثقة" : "Learn with confidence"}</p>
          <strong>
            {isAr ? "كل جلسة تبدأ بهدف." : "Every lesson begins with a goal."}
          </strong>
          <span>{isAr ? "القاهرة • العالم" : "Cairo • Worldwide"}</span>
        </div>
      </div>
      <div className="academy-footer-bottom">
        <p>
          © {new Date().getFullYear()} MRH Academy.{" "}
          {isAr ? "جميع الحقوق محفوظة." : "All rights reserved."}
        </p>
        <p>{isAr ? "تعلّم يصنع أثرًا" : "Learning that moves you forward"}</p>
      </div>
    </footer>
  );
}
