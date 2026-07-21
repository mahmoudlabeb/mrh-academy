"use client";

import { useState, type ReactNode, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { useLanguage } from "@/contexts/language-context";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";
import MyLessons from "./components/MyLessons";
import MessagesView from "./components/MessagesView";
import SettingsView from "./components/SettingsView";
import PaymentModal from "./components/PaymentModal";
import PaymentHistory from "./components/PaymentHistory";
import NotificationsPanel from "./components/NotificationsPanel";

type Tab = "discover" | "lessons" | "messages" | "payments" | "settings";

const tabs: { key: Tab; labelAr: string; labelEn: string }[] = [
  { key: "discover", labelAr: "اكتشف", labelEn: "Discover" },
  { key: "lessons", labelAr: "دروسي", labelEn: "My Lessons" },
  { key: "payments", labelAr: "المدفوعات", labelEn: "Payments" },
  { key: "messages", labelAr: "الرسائل", labelEn: "Messages" },
  { key: "settings", labelAr: "الإعدادات", labelEn: "Settings" },
];

const tabIcons: Record<Tab, ReactNode> = {
  discover: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  ),
  lessons: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
      />
    </svg>
  ),
  payments: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
      />
    </svg>
  ),
  messages: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
      />
    </svg>
  ),
  settings: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  ),
};

export const dynamic = "force-dynamic";

function StudentDashboardContent() {
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLanguage } = useLanguage();
  const initialTab = (searchParams.get("tab") as Tab) || "discover";
  const [activeTab, setActiveTab] = useState<Tab>(
    ["discover", "lessons", "payments", "messages", "settings"].includes(
      initialTab,
    )
      ? initialTab
      : "discover",
  );
  const [showPayment, setShowPayment] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const { data: balance } = useQuery({
    queryKey: ["student-balance"],
    queryFn: async () => {
      const { data } = await apiClient.get("/students/balance");
      return data;
    },
  });

  const { data: notifData } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: async () => {
      const { data } = await apiClient.get("/notifications?unread=true");
      return { count: Array.isArray(data) ? data.length : (data?.count ?? 0) };
    },
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const { data: msgUnread } = useQuery({
    queryKey: ["messages-unread"],
    queryFn: async () => {
      const { data } = await apiClient.get("/messages/unread-count");
      return { count: data?.count ?? 0 };
    },
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const renderContent = () => {
    switch (activeTab) {
      case "discover":
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger-children">
            <Link
              href="/student/discover"
              className="card-gold p-8 group animate-slide-up"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all group-hover:scale-110"
                style={{ background: "rgba(212, 163, 83,0.15)" }}
              >
                <svg
                  className="w-7 h-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="#D4A353"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
              </div>
              <h2
                className="text-xl font-bold mb-2"
                style={{ color: "var(--text-main)" }}
              >
                {t("اكتشف المعلمين", "Discover Tutors")}
              </h2>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {t(
                  "ابحث وصنف واعثر على المعلم المثالي لأهدافك التعليمية.",
                  "Search, filter, and find the perfect tutor for your learning goals.",
                )}
              </p>
              <span className="link inline-flex items-center gap-1 mt-4 text-sm">
                {t("ابحث عن معلم", "Find a Tutor")}
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={
                      lang === "ar"
                        ? "M14 5l-7 7 7 7"
                        : "M10 19l-7-7m0 0l7-7m-7 7h18"
                    }
                  />
                </svg>
              </span>
            </Link>
            <Link
              href="/student/discover?sort=asc"
              className="card-gold p-8 group animate-slide-up"
              style={{ animationDelay: "0.1s" }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all group-hover:scale-110"
                style={{ background: "rgba(212, 163, 83,0.15)" }}
              >
                <svg
                  className="w-7 h-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="#D4A353"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2
                className="text-xl font-bold mb-2"
                style={{ color: "var(--text-main)" }}
              >
                {t("الدروس الأخيرة", "Recent Lessons")}
              </h2>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {t(
                  "عرض الدروس السابقة وجدولتها.",
                  "View and schedule your past and upcoming lessons.",
                )}
              </p>
              <span className="link inline-flex items-center gap-1 mt-4 text-sm">
                {t("عرض الدروس", "View Lessons")}
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={
                      lang === "ar"
                        ? "M14 5l-7 7 7 7"
                        : "M10 19l-7-7m0 0l7-7m-7 7h18"
                    }
                  />
                </svg>
              </span>
            </Link>
            <Link
              href="/student/discover?sort=desc"
              className="card-gold p-8 group animate-slide-up"
              style={{ animationDelay: "0.2s" }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all group-hover:scale-110"
                style={{ background: "rgba(212, 163, 83,0.15)" }}
              >
                <svg
                  className="w-7 h-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="#D4A353"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                  />
                </svg>
              </div>
              <h2
                className="text-xl font-bold mb-2"
                style={{ color: "var(--text-main)" }}
              >
                {t("أفضل المعلمين", "Top Tutors")}
              </h2>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {t(
                  "أفضل المعلمين تقييماً على المنصة.",
                  "Highest rated tutors on the platform.",
                )}
              </p>
              <span className="link inline-flex items-center gap-1 mt-4 text-sm">
                {t("استعرض", "Browse")}
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={
                      lang === "ar"
                        ? "M14 5l-7 7 7 7"
                        : "M10 19l-7-7m0 0l7-7m-7 7h18"
                    }
                  />
                </svg>
              </span>
            </Link>
          </div>
        );
      case "lessons":
        return <MyLessons />;
      case "payments":
        return <PaymentHistory />;
      case "messages":
        return <MessagesView />;
      case "settings":
        return <SettingsView />;
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-main)" }}>
      <header className="dashboard-header">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 md:gap-3">
              <Link
                href="/"
                className="logo text-lg md:text-xl font-extrabold tracking-tight"
                style={{ color: "#D4A353", fontFamily: "'Inter', sans-serif" }}
              >
                MR.H
              </Link>
              <div
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(212, 163, 83,0.12)" }}
              >
                <span
                  className="text-sm font-bold"
                  style={{ color: "#D4A353" }}
                >
                  {balance?.balance ?? "0.00"}
                </span>
                <span className="text-xs" style={{ color: "#E4CC9C" }}>
                  {t("رصيد", "Credits")}
                </span>
              </div>
              <button
                onClick={() => setShowPayment(true)}
                className="btn-primary text-xs md:text-sm px-3 md:px-4 py-1.5"
              >
                {t("اشتراك", "Subscribe")}
              </button>
            </div>

            <div className="flex items-center gap-1 md:gap-1.5">
              <button
                type="button"
                onClick={() => setShowNotifications(true)}
                className="relative p-2 rounded-lg hover:bg-white/5 transition-colors"
                title={t("الإشعارات", "Notifications")}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="#FFFFF0"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
                {(notifData?.count ?? 0) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {(notifData?.count ?? 0) > 9 ? "9+" : notifData?.count}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("messages")}
                className="relative p-2 rounded-lg hover:bg-white/5 transition-colors"
                title={t("الرسائل", "Messages")}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="#FFFFF0"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                  />
                </svg>
                {(msgUnread?.count ?? 0) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {(msgUnread?.count ?? 0) > 9 ? "9+" : msgUnread?.count}
                  </span>
                )}
              </button>

              <button
                onClick={toggleLanguage}
                className="px-2.5 py-1.5 rounded-lg text-sm font-semibold transition-colors hover:bg-white/5 text-[#FFFFF0]"
              >
                {lang === "ar" ? "EN" : "AR"}
              </button>

              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                {theme === "dark" ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="#FFFFF0"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="#FFFFF0"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                    />
                  </svg>
                )}
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 p-1 pe-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs"
                    style={{ background: "#D4A353" }}
                  >
                    {user?.firstName?.[0] || "U"}
                  </div>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="#E4CC9C"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {showProfileMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowProfileMenu(false)}
                    />
                    <div
                      className="absolute top-full left-0 mt-2 w-52 rounded-xl py-2 shadow-xl z-20 animate-scale-in"
                      style={{
                        background: "var(--bg-light)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div
                        className="px-4 py-3 border-b"
                        style={{ borderColor: "var(--border-color)" }}
                      >
                        <p
                          className="text-sm font-bold"
                          style={{ color: "var(--text-main)" }}
                        >
                          {user?.firstName} {user?.lastName}
                        </p>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {user?.email}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          setActiveTab("settings");
                        }}
                        className="w-full text-right px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-2"
                        style={{ color: "var(--text-main)" }}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                          />
                        </svg>
                        {t("الإعدادات", "Settings")}
                      </button>
                      <Link
                        href="/become-teacher"
                        className="block px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-2"
                        style={{ color: "var(--text-main)" }}
                        onClick={() => setShowProfileMenu(false)}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342"
                          />
                        </svg>
                        {t("التحول إلى معلم", "Switch to Tutor")}
                      </Link>
                      <hr style={{ borderColor: "var(--border-color)" }} />
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          logout();
                        }}
                        className="w-full text-right px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-2"
                        style={{ color: "#ef4444" }}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                          />
                        </svg>
                        {t("تسجيل الخروج", "Logout")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav
        className="sticky top-0 z-10 backdrop-blur-xl"
        style={{
          background: "var(--bg-light)",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all relative ${
                  activeTab === tab.key
                    ? "text-[#D4A353]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
              >
                {tabIcons[tab.key]}
                <span>{lang === "ar" ? tab.labelAr : tab.labelEn}</span>
                {activeTab === tab.key && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: "#D4A353" }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="animate-fade-in" key={activeTab}>
          {renderContent()}
        </div>
      </main>

      {showPayment && (
        <PaymentModal
          onClose={() => setShowPayment(false)}
          currentBalance={String(balance?.balance ?? "0.00")}
          egpRate={balance?.egpRate ?? 50}
        />
      )}
      {showNotifications && (
        <NotificationsPanel onClose={() => setShowNotifications(false)} />
      )}
    </div>
  );
}

export default function StudentDashboard() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen"
          style={{ background: "var(--bg-main)" }}
        />
      }
    >
      <StudentDashboardContent />
    </Suspense>
  );
}
