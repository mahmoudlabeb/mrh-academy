"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDownIcon,
  LogoutIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  UserIcon,
} from "@/components/icons/Icons";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";
import { BrandMark } from "@/components/shared/BrandMark";

type Workspace = "learn" | "teach" | "ops";

type NavigationItem = {
  path: string;
  en: string;
  ar: string;
};

const navigation: Record<Workspace, readonly NavigationItem[]> = {
  learn: [
    { path: "", en: "Today", ar: "اليوم" },
    { path: "/lessons", en: "Lessons", ar: "الدروس" },
    { path: "/courses", en: "Courses", ar: "الدورات" },
    { path: "/messages", en: "Messages", ar: "الرسائل" },
    { path: "/wallet", en: "Wallet", ar: "المحفظة" },
    { path: "/saved", en: "Saved", ar: "المحفوظات" },
  ],
  teach: [
    { path: "", en: "Home", ar: "الرئيسية" },
    { path: "/classroom", en: "Classroom", ar: "الفصل" },
    { path: "/schedule", en: "Schedule & availability", ar: "الجدول والتوافر" },
    { path: "/students", en: "Students", ar: "الطلاب" },
    { path: "/messages", en: "Messages", ar: "الرسائل" },
    { path: "/courses", en: "Courses", ar: "الدورات" },
    { path: "/earnings", en: "Earnings", ar: "الأرباح" },
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
  const [profileOpen, setProfileOpen] = useState(false);
  const base = `/${lang}/${workspace}`;
  const settingsHref =
    workspace === "ops" ? `/${lang}/account/profile` : `${base}/settings`;
  const items = navigation[workspace];
  const navigationRef = useRef<HTMLElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!profileOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setProfileOpen(false);
      requestAnimationFrame(() => profileButtonRef.current?.focus());
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileOpen]);

  if (isLoading) {
    return (
      <main className="workspace-gate" aria-busy="true">
        <div className="focus-skeleton" />
      </main>
    );
  }
  if (!allowed) {
    const roleHome =
      user?.role === "student"
        ? `/${lang}/learn`
        : user?.role === "tutor"
          ? `/${lang}/teach`
          : user?.role === "admin" || user?.role === "subadmin"
            ? `/${lang}/ops`
            : `/${lang}`;
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
          href={
            user
              ? roleHome
              : `/${lang}/sign-in?next=${encodeURIComponent(pathname)}`
          }
        >
          {user
            ? lang === "ar"
              ? "الانتقال إلى مساحة عملك"
              : "Go to your workspace"
            : lang === "ar"
              ? "تسجيل الدخول"
              : "Sign in"}
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
          <BrandMark />
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
            const href = `${base}${item.path}`;
            const active =
              item.path === ""
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
            aria-label={
              lang === "ar" ? "Switch to English" : "التبديل إلى العربية"
            }
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
          <div className="workspace-profile" ref={profileRef}>
            <button
              ref={profileButtonRef}
              className="workspace-profile-trigger"
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowDown") return;
                event.preventDefault();
                setProfileOpen(true);
                requestAnimationFrame(() =>
                  profileRef.current
                    ?.querySelector<HTMLElement>("a, button:not(:first-child)")
                    ?.focus(),
                );
              }}
              aria-expanded={profileOpen}
              aria-controls="workspace-profile-menu"
              aria-label={
                lang === "ar" ? "فتح قائمة الحساب" : "Open account menu"
              }
            >
              <span className="workspace-avatar">
                {user?.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt=""
                    width={38}
                    height={38}
                    sizes="38px"
                  />
                ) : (
                  <span aria-hidden="true">
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </span>
                )}
              </span>
              <ChevronDownIcon
                className={
                  profileOpen ? "profile-chevron open" : "profile-chevron"
                }
              />
            </button>
            {profileOpen && (
              <div
                className="workspace-profile-menu"
                id="workspace-profile-menu"
              >
                <div className="workspace-profile-identity">
                  <strong>
                    {user?.firstName} {user?.lastName}
                  </strong>
                  <span dir="auto">{user?.email}</span>
                </div>
                <Link href={settingsHref} onClick={() => setProfileOpen(false)}>
                  <SettingsIcon />
                  <span>{lang === "ar" ? "الإعدادات" : "Settings"}</span>
                </Link>
                {workspace === "teach" && (
                  <Link
                    href={`/${lang}/teach/profile`}
                    onClick={() => setProfileOpen(false)}
                  >
                    <UserIcon />
                    <span>{lang === "ar" ? "الملف الشخصي" : "Profile"}</span>
                  </Link>
                )}
                <button
                  type="button"
                  className="workspace-profile-logout"
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                >
                  <LogoutIcon />
                  <span>{lang === "ar" ? "تسجيل الخروج" : "Log out"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="workspace-content">{children}</div>
    </div>
  );
}
