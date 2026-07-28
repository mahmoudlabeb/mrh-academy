"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import StudentMessages from "@/app/student/components/MessagesView";
import TutorMessages from "@/app/tutor/components/MessagesView";

export default function MessagesPage() {
  const { user, isLoading } = useAuth();
  const { lang } = useLanguage();
  const isAr = lang === "ar";

  if (isLoading) {
    return (
      <main className="focus-page" aria-busy="true">
        <div className="focus-skeleton" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="focus-page focus-empty">
        <h1>
          {isAr ? "سجّل الدخول لعرض رسائلك" : "Sign in to view your messages"}
        </h1>
        <Link className="btn-primary" href="/login">
          {isAr ? "تسجيل الدخول" : "Sign in"}
        </Link>
      </main>
    );
  }

  const home =
    user.role === "tutor"
      ? "/tutor"
      : user.role === "admin" || user.role === "subadmin"
        ? "/ops"
        : "/student";
  const supportsDirectMessages =
    user.role === "student" || user.role === "tutor";
  return (
    <main className="focus-page">
      <header className="focus-page-header">
        <div>
          <p className="focus-eyebrow">
            {isAr ? "المحادثات المباشرة" : "Direct conversations"}
          </p>
          <h1>{isAr ? "الرسائل" : "Messages"}</h1>
        </div>
        <Link className="btn-secondary" href={home}>
          {isAr ? "الخروج إلى مساحة العمل" : "Exit to workspace"}
        </Link>
      </header>
      <section className="focus-panel">
        {!supportsDirectMessages ? (
          <div className="focus-empty">
            <h2>
              {isAr
                ? "الرسائل غير متاحة لهذا الدور"
                : "Messages are not available for this role"}
            </h2>
            <p>
              {isAr
                ? "استخدم قائمة العمليات للوصول إلى مهام الإدارة المصرح بها."
                : "Use the operations queue for your authorized administrative work."}
            </p>
            <Link className="btn-secondary" href="/ops">
              {isAr ? "فتح قائمة العمليات" : "Open operations queue"}
            </Link>
          </div>
        ) : user.role === "tutor" ? (
          <TutorMessages />
        ) : (
          <StudentMessages />
        )}
      </section>
    </main>
  );
}
