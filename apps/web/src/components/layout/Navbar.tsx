"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";
import {
  CloseIcon,
  MenuIcon,
  MoonIcon,
  SunIcon,
} from "@/components/icons/Icons";
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

  const links = useMemo(
    () => [
      { label: isAr ? "الدورات" : "Courses", href: "/courses" },
      {
        label: isAr ? "ابحث عن معلم" : "Find a tutor",
        href: "/student/discover",
      },
      { label: isAr ? "كن معلمًا" : "Become a tutor", href: "/become-teacher" },
      {
        label: isAr ? "تدريب المعلمين" : "Tutor training",
        href: "/teacher-training",
      },
    ],
    [isAr],
  );

  const dashboardHref = user
    ? user.role === "student"
      ? "/student"
      : user.role === "tutor"
        ? "/tutor"
        : "/admin"
    : "/login";
  const ThemeToggleIcon = theme === "dark" ? SunIcon : MoonIcon;
  const isActiveRoute = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const closeMobileMenu = (restoreFocus = false) => {
    setMobileOpen(false);
    if (restoreFocus)
      requestAnimationFrame(() => menuButtonRef.current?.focus());
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => firstMobileLinkRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        requestAnimationFrame(() => menuButtonRef.current?.focus());
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  return (
    <nav
      className="academy-navbar"
      lang={activeLanguage}
      dir={isAr ? "rtl" : "ltr"}
      aria-label={isAr ? "التنقل الرئيسي" : "Main navigation"}
    >
      <div className="academy-navbar-inner">
        <Link
          href={isAr ? "/" : "/en"}
          className="academy-brand"
          aria-label={
            isAr ? "الصفحة الرئيسية لأكاديمية مستر إتش" : "Mr.H Academy home"
          }
        >
          <span className="academy-crest" aria-hidden="true">
            <b>H</b>
            <small>ACADEMY</small>
          </span>
          <span className="academy-wordmark">
            <strong>Mr.H</strong>
            <small>{isAr ? "أكاديمية اللغات" : "LANGUAGE ACADEMY"}</small>
          </span>
        </Link>

        <div className="academy-nav-desktop">
          <div className="academy-nav-links">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={isActiveRoute(link.href) ? "active" : ""}
                aria-current={isActiveRoute(link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="academy-nav-auth">
            {user ? (
              <>
                <Link href={dashboardHref} className="academy-account-link">
                  {isAr ? "لوحة التحكم" : "Dashboard"}
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="academy-signout"
                >
                  {isAr ? "خروج" : "Log out"}
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="academy-login-link">
                  {isAr ? "دخول" : "Log in"}
                </Link>
                <Link href="/register" className="academy-account-link">
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
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
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
            onClick={() =>
              mobileOpen ? closeMobileMenu(true) : setMobileOpen(true)
            }
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
                className={isActiveRoute(link.href) ? "active" : ""}
                aria-current={isActiveRoute(link.href) ? "page" : undefined}
                onClick={() => closeMobileMenu()}
              >
                <span>0{index + 1}</span>
                {link.label}
              </Link>
            ))}
            <div className="academy-mobile-auth">
              {user ? (
                <>
                  <Link
                    href={dashboardHref}
                    className="academy-account-link"
                    onClick={() => closeMobileMenu()}
                  >
                    {isAr ? "لوحة التحكم" : "Dashboard"}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      closeMobileMenu();
                    }}
                    className="academy-signout"
                  >
                    {isAr ? "تسجيل الخروج" : "Log out"}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="academy-login-link"
                    onClick={() => closeMobileMenu()}
                  >
                    {isAr ? "تسجيل الدخول" : "Log in"}
                  </Link>
                  <Link
                    href="/register"
                    className="academy-account-link"
                    onClick={() => closeMobileMenu()}
                  >
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
