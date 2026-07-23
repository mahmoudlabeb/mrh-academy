"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { useLanguage } from "@/contexts/language-context";
import OverviewTab from "./components/OverviewTab";
import TutorsTab from "./components/TutorsTab";
import StudentsTab from "./components/StudentsTab";
import LessonsTab from "./components/LessonsTab";
import ReportsTab from "./components/ReportsTab";
import EmployeesTab from "./components/EmployeesTab";
import CoursesTab from "./components/CoursesTab";
import ReviewsTab from "./components/ReviewsTab";
import PaymentsTab from "./components/PaymentsTab";
import SettingsTab from "./components/SettingsTab";
import AdminPayoutsPage from "./payouts/page";

const tabs = [
  { id: "overview", label: "نظرة عامة", labelEn: "Overview" },
  { id: "tutors", label: "المدرسين وأدائهم", labelEn: "Tutors & Performance" },
  { id: "students", label: "الطلاب وبياناتهم", labelEn: "Students & Data" },
  { id: "lessons", label: "الدروس والحصص", labelEn: "Lessons" },
  { id: "reports", label: "البلاغات والمشاكل", labelEn: "Reports" },
  { id: "employees", label: "الموظفين والصلاحيات", labelEn: "Employees" },
  { id: "courses", label: "إدارة الكورسات", labelEn: "Course Management" },
  { id: "reviews", label: "مراجعة التقييمات", labelEn: "Reviews Moderation" },
  { id: "payments", label: "المدفوعات والاشتراكات", labelEn: "Payments" },
  { id: "payouts", label: "سحوبات المدرسين", labelEn: "Tutor Payouts" },
  { id: "settings", label: "إعدادات المنصة", labelEn: "Settings" },
];

const tabIcons: Record<string, React.ReactNode> = {
  overview: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605"
      />
    </svg>
  ),
  tutors: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
      />
    </svg>
  ),
  students: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342"
      />
    </svg>
  ),
  lessons: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
      />
    </svg>
  ),
  reports: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
  ),
  employees: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
      />
    </svg>
  ),
  courses: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
      />
    </svg>
  ),
  reviews: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    </svg>
  ),
  payments: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m0 0v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5m18 0v9a2.25 2.25 0 01-2.25 2.25h-.75m-13.5-7.5h3.75m-3.75 3h3.75m-3.75 3h3.75"
      />
    </svg>
  ),
  payouts: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  settings: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  ),
};

export const dynamic = "force-dynamic";

const SUBADMIN_RESTRICTED_TABS = new Set(["payments", "payouts", "settings"]);

export default function AdminPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLanguage } = useLanguage();
  const isSubAdmin = user?.role === "subadmin";
  const filteredTabs = tabs.filter(
    (t) => !isSubAdmin || !SUBADMIN_RESTRICTED_TABS.has(t.id),
  );
  const [activeTab, setActiveTab] = useState("overview");
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.tab && filteredTabs.some((t) => t.id === detail.tab)) {
        setActiveTab(detail.tab);
      }
    };
    window.addEventListener("admin-navigate", handler);
    return () => window.removeEventListener("admin-navigate", handler);
  }, [filteredTabs]);

  const renderTab = () => {
    if (isSubAdmin && SUBADMIN_RESTRICTED_TABS.has(activeTab)) {
      return <OverviewTab />;
    }
    switch (activeTab) {
      case "overview":
        return <OverviewTab />;
      case "tutors":
        return <TutorsTab />;
      case "students":
        return <StudentsTab />;
      case "lessons":
        return <LessonsTab />;
      case "reports":
        return <ReportsTab />;
      case "employees":
        return <EmployeesTab />;
      case "courses":
        return <CoursesTab />;
      case "reviews":
        return <ReviewsTab />;
      case "payments":
        return <PaymentsTab />;
      case "payouts":
        return <AdminPayoutsPage />;
      case "settings":
        return <SettingsTab />;
      default:
        return <OverviewTab />;
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-main)" }}
    >
      <header
        className="w-full shrink-0 flex flex-col"
        style={{
          background: "#0F3A40",
          borderBottom: "1px solid #1D535B",
          borderInlineStart: "none",
        }}
      >
        <div className="p-5 border-b border-[#1D535B]">
          <h2
            className="text-lg font-bold logo-font"
            style={{ color: "#D4A353" }}
          >
            Mr.H Academy
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "#E4CC9C" }}>
            لوحة الإدارة
          </p>
        </div>
        <nav
          aria-label={lang === "ar" ? "التنقل في لوحة الإدارة" : "Admin dashboard navigation"}
          className="admin-top-nav flex w-full gap-1 overflow-x-auto px-3 pb-3"
        >
          {filteredTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="shrink-0 flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-start"
                aria-current={isActive ? "page" : undefined}
                style={{
                  background: isActive
                    ? "rgba(212, 163, 83,0.12)"
                    : "transparent",
                  color: isActive ? "#D4A353" : "#E4CC9C",
                  border: isActive
                    ? "1px solid rgba(212, 163, 83,0.2)"
                    : "1px solid transparent",
                }}
              >
                <span className="shrink-0">{tabIcons[tab.id]}</span>
                <div className="min-w-0">
                  <div className="truncate">{tab.label}</div>
                  <div className="text-[10px] opacity-60 truncate">
                    {tab.labelEn}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </header>

      <div className="flex-1 flex flex-col min-h-screen">
        <header
          className="sticky top-0 z-30"
          style={{ background: "#0F3A40", borderBottom: "1px solid #1D535B" }}
        >
          <div className="flex items-center justify-between px-4 md:px-6 py-3">
            <div>
              <p className="text-sm" style={{ color: "#E4CC9C" }}>
                {lang === "ar"
                  ? `مرحبًا بعودتك، ${user?.firstName}`
                  : `Welcome back, ${user?.firstName}`}
              </p>
              <p className="text-xs" style={{ color: "#5a7d73" }}>
                {user?.email}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleLanguage}
                className="btn-ghost px-3 py-2 text-xs font-bold"
                style={{ color: "#D4A353" }}
              >
                {lang === "ar" ? "EN" : "AR"}
              </button>
              <button
                onClick={toggleTheme}
                className="btn-ghost px-3 py-2"
                style={{ color: "#E4CC9C" }}
                aria-label={
                  theme === "dark"
                    ? lang === "ar"
                      ? "التبديل إلى الوضع الفاتح"
                      : "Switch to light mode"
                    : lang === "ar"
                      ? "التبديل إلى الوضع الداكن"
                      : "Switch to dark mode"
                }
                title={
                  theme === "dark"
                    ? lang === "ar"
                      ? "التبديل إلى الوضع الفاتح"
                      : "Switch to light mode"
                    : lang === "ar"
                      ? "التبديل إلى الوضع الداكن"
                      : "Switch to dark mode"
                }
              >
                {theme === "dark" ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                    />
                  </svg>
                )}
              </button>
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
                  style={{
                    background: profileOpen
                      ? "rgba(212, 163, 83,0.12)"
                      : "transparent",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: "#D4A353" }}
                  >
                    {user?.firstName?.[0] || "A"}
                  </div>
                  <svg
                    className={`w-4 h-4 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    style={{ color: "#E4CC9C" }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {profileOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setProfileOpen(false)}
                    />
                    <div
                      className="absolute left-0 top-full mt-1 w-56 z-20 rounded-xl overflow-hidden animate-scale-in"
                      style={{
                        background: "#1D535B",
                        border: "1px solid #1D535B",
                        boxShadow: "0 12px 24px rgba(0,0,0,0.4)",
                      }}
                    >
                      <div className="px-4 py-3 border-b border-[#1D535B]">
                        <p
                          className="text-sm font-semibold"
                          style={{ color: "#FFFFF0" }}
                        >
                          {user?.firstName} {user?.lastName}
                        </p>
                        <p className="text-xs" style={{ color: "#E4CC9C" }}>
                          {user?.email}
                        </p>
                      </div>
                      <div className="p-1">
                        <button
                          onClick={logout}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all text-right"
                          style={{ color: "#ef4444" }}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                            />
                          </svg>
                          {lang === "ar" ? "تسجيل الخروج" : "Logout"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">{renderTab()}</main>
      </div>
    </div>
  );
}
