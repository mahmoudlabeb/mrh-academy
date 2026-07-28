"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CloseIcon,
  MenuIcon,
  MoonIcon,
  SunIcon,
} from "@/components/icons/Icons";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";
import NotificationBell from "./NotificationBell";

export default function Navbar({ language }: { language?: "ar" | "en" } = {}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLanguage } = useLanguage();
  const activeLanguage = language ?? lang;
  const isAr = activeLanguage === "ar";
  const localeBase = `/${activeLanguage}`;
  const localize = (path: string) =>
    path === "/" ? localeBase : `${localeBase}${path}`;

  const links = [
      {
        label: isAr ? "ابحث عن معلّم" : "Find a tutor",
        href: localize("/tutors"),
      },
      {
        label: isAr ? "مكتبة الدورات" : "Course library",
        href: localize("/courses"),
      },
      {
        label: isAr ? "انضم كمدرّس" : "Become a tutor",
        href: localize("/become-a-tutor"),
      },
      {
        label: isAr ? "موارد المعلّمين" : "Teaching resources",
        href: localize("/resources"),
      },
    ];

  const dashboardHref = user
      ? user.role === "student"
      ? localize("/learn")
      : user.role === "tutor"
        ? localize("/teach")
        : localize("/ops")
    : localize("/sign-in");
  const ThemeToggleIcon = theme === "dark" ? SunIcon : MoonIcon;
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => firstMobileLinkRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileOpen(false);
      requestAnimationFrame(() => menuButtonRef.current?.focus());
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  return (
    <nav
      className="academy-navbar"
      lang={activeLanguage}
      dir={isAr ? "rtl" : "ltr"}
      aria-label={isAr ? "التنقّل الرئيسي" : "Main navigation"}
    >
      <div className="academy-navbar-inner">
        <Link
          href={localeBase}
          className="academy-brand"
          aria-label={
            isAr ? "الصفحة الرئيسية لأكاديمية MRH" : "MRH Academy home"
          }
        >
          <span className="academy-crest" aria-hidden="true">
            M
          </span>
          <span className="academy-wordmark">
            <strong>MRH Academy</strong>
          </span>
        </Link>

        <div className="academy-nav-desktop">
          <div className="academy-nav-links">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={isActive(link.href) ? "active" : ""}
                aria-current={isActive(link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="academy-nav-auth">
            {user ? (
              <>
                <Link href={dashboardHref} className="academy-account-link">
                  {isAr ? "مساحة العمل" : "Workspace"}
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="academy-signout"
                >
                  {isAr ? "تسجيل الخروج" : "Sign out"}
                </button>
              </>
            ) : (
              <>
                <Link href={localize("/sign-in")} className="academy-login-link">
                  {isAr ? "تسجيل الدخول" : "Sign in"}
                </Link>
                <Link href={localize("/sign-up")} className="academy-account-link">
                  {isAr ? "ابدأ التعلّم" : "Start learning"}
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="academy-nav-utilities">
          <button
            type="button"
            onClick={toggleTheme}
            className="academy-icon-button"
            aria-label={
              theme === "dark"
                ? isAr
                  ? "استخدم المظهر الفاتح"
                  : "Use light theme"
                : isAr
                  ? "استخدم المظهر الداكن"
                  : "Use dark theme"
            }
          >
            <ThemeToggleIcon />
          </button>
          <button
            type="button"
            onClick={toggleLanguage}
            className="academy-language-button"
            aria-label={isAr ? "Switch to English" : "التبديل إلى العربية"}
          >
            {isAr ? "EN" : "ع"}
          </button>
          {user && <NotificationBell />}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="academy-icon-button academy-mobile-menu-button"
            aria-label={
              mobileOpen
                ? isAr
                  ? "إغلاق القائمة"
                  : "Close menu"
                : isAr
                  ? "فتح القائمة"
                  : "Open menu"
            }
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div id="mobile-navigation" className="academy-mobile-panel">
          <div className="academy-mobile-panel-inner">
            <p>{isAr ? "استكشف الأكاديمية" : "Explore the academy"}</p>
            {links.map((link, index) => (
              <Link
                key={link.href}
                ref={index === 0 ? firstMobileLinkRef : undefined}
                href={link.href}
                className={isActive(link.href) ? "active" : ""}
                aria-current={isActive(link.href) ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
              >
                <span>0{index + 1}</span>
                {link.label}
              </Link>
            ))}
            <div className="academy-mobile-auth">
              {user ? (
                <>
                  <Link href={dashboardHref} className="academy-account-link">
                    {isAr ? "مساحة العمل" : "Workspace"}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setMobileOpen(false);
                    }}
                    className="academy-signout"
                  >
                    {isAr ? "تسجيل الخروج" : "Sign out"}
                  </button>
                </>
              ) : (
                <>
                  <Link href={localize("/sign-in")} className="academy-login-link">
                    {isAr ? "تسجيل الدخول" : "Sign in"}
                  </Link>
                  <Link href={localize("/sign-up")} className="academy-account-link">
                    {isAr ? "ابدأ التعلّم" : "Start learning"}
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
