"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { MoonIcon, SunIcon } from "@/components/icons/Icons";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";

type Workspace = "learn" | "teach" | "ops";

type NavigationItem = {
  path: string;
  en: string;
  ar: string;
  shared?: boolean;
};

const navigation: Record<Workspace, readonly NavigationItem[]> = {
  learn: [
    { path: "", en: "Today", ar: "اليوم" },
    { path: "/lessons", en: "Lessons", ar: "الدروس" },
    { path: "/courses", en: "Courses", ar: "الدورات" },
    { path: "/messages", en: "Messages", ar: "الرسائل", shared: true },
    { path: "/wallet", en: "Wallet", ar: "المحفظة" },
    { path: "/saved", en: "Saved", ar: "المحفوظات" },
    { path: "/words", en: "Vocabulary", ar: "المفردات" },
  ],
  teach: [
    { path: "", en: "Home", ar: "الرئيسية" },
    { path: "/classroom", en: "Classroom", ar: "الفصل" },
    { path: "/schedule", en: "Schedule & availability", ar: "الجدول والتوافر" },
    { path: "/students", en: "Students", ar: "الطلاب" },
    { path: "/messages", en: "Messages", ar: "الرسائل", shared: true },
    { path: "/courses", en: "Courses", ar: "الدورات" },
    { path: "/earnings", en: "Earnings", ar: "الأرباح" },
    { path: "/profile", en: "Profile", ar: "الملف" },
  ],
  ops: [
    { path: "", en: "Queue", ar: "قائمة القرارات" },
    { path: "/people", en: "People", ar: "الأشخاص" },
    { path: "/lessons", en: "Lessons", ar: "الدروس" },
    { path: "/money/payments", en: "Payments", ar: "المدفوعات" },
    { path: "/settings", en: "Settings", ar: "الإعدادات" },
  ],
} as const;

export function BlueprintWorkspaceShell({
  workspace,
  children,
}: {
  workspace: Workspace;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const { lang, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const base = `/${lang}/${workspace}`;
  const items = navigation[workspace];
  const navigationRef = useRef<HTMLElement>(null);
  const allowed =
    workspace === "learn"
      ? user?.role === "student"
      : workspace === "teach"
        ? user?.role === "tutor"
        : user?.role === "admin" || user?.role === "subadmin";

  useEffect(() => {
    if (!window.matchMedia("(max-width: 820px)").matches) return;
    const activeItem = navigationRef.current?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    activeItem?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [lang, pathname, workspace]);

  if (isLoading) {
    return (
      <main className="workspace-gate" aria-busy="true">
        <div className="focus-skeleton" />
      </main>
    );
  }
  if (!allowed) {
    return (
      <main className="workspace-gate">
        <h1>{lang === "ar" ? "غير مصرح لك بالدخول" : "Access unavailable"}</h1>
        <p>
          {lang === "ar"
            ? "هذه المساحة مرتبطة بدور وصلاحيات حسابك."
            : "This workspace is restricted to the corresponding account role and permissions."}
        </p>
        <Link
          className="btn-primary"
          href={`/${lang}/sign-in?next=${encodeURIComponent(pathname)}`}
        >
          {lang === "ar" ? "تسجيل الدخول" : "Sign in"}
        </Link>
      </main>
    );
  }

  return (
    <div
      className={`blueprint-workspace blueprint-workspace-${workspace}`}
      data-workspace={workspace}
    >
      <header className="workspace-header">
        <Link className="workspace-brand" href={base}>
          <span aria-hidden="true">
            {workspace === "teach" ? "T" : workspace === "ops" ? "O" : "M"}
          </span>
          <strong>
            {workspace === "ops" ? "MRH Operations Hub" : "MRH Academy"}
          </strong>
        </Link>
        <nav
          ref={navigationRef}
          aria-label={
            lang === "ar" ? "تنقل مساحة العمل" : "Workspace navigation"
          }
        >
          {items.map((item) => {
            const href = item.shared
              ? `/${lang}${item.path}`
              : `${base}${item.path}`;
            const active = item.shared
              ? pathname === href || pathname.startsWith(`${href}/`)
              : item.path === ""
                ? pathname === base
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={active ? "active" : undefined}
                aria-current={active ? "page" : undefined}
              >
                {item[lang]}
              </Link>
            );
          })}
        </nav>
        <div className="workspace-account-actions">
          <button
            className="workspace-utility"
            type="button"
            onClick={toggleLanguage}
            aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
            title={lang === "ar" ? "English" : "العربية"}
          >
            <span>{lang === "ar" ? "EN" : "ع"}</span>
          </button>
          <button
            className="workspace-utility"
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === "dark"
                ? lang === "ar"
                  ? "استخدام المظهر الفاتح"
                  : "Use light theme"
                : lang === "ar"
                  ? "استخدام المظهر الداكن"
                  : "Use dark theme"
            }
            title={
              theme === "dark"
                ? lang === "ar"
                  ? "المظهر الفاتح"
                  : "Light theme"
                : lang === "ar"
                  ? "المظهر الداكن"
                  : "Dark theme"
            }
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <Link className="workspace-avatar" href={`/${lang}/account/profile`}>
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" />
            ) : (
              <span aria-hidden="true">
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </span>
            )}
            <span className="sr-only">
              {lang === "ar" ? "إعدادات الحساب" : "Account settings"}
            </span>
          </Link>
          <button className="workspace-logout" type="button" onClick={logout}>
            {lang === "ar" ? "تسجيل الخروج" : "Log out"}
          </button>
        </div>
      </header>
      <div className="workspace-content">{children}</div>
    </div>
  );
}
