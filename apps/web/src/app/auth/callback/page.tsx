"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";
import Link from "next/link";

function AuthCallbackContent() {
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const router = useRouter();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    apiClient
      .get("/users/me")
      .then(({ data }) => {
        const role = data.role as string;
        if (role === "tutor") {
          router.push(`/${lang}/teach`);
        } else if (role === "admin" || role === "subadmin") {
          router.push(`/${lang}/ops`);
        } else {
          router.push(`/${lang}/learn`);
        }
      })
      .catch(() => {
        setHasError(true);
      });
  }, [lang, router]);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card p-8 text-center max-w-sm animate-scale-in">
          <div className="w-14 h-14 rounded-full bg-[var(--danger-soft)] flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-[var(--danger)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <p className="text-[var(--danger)] font-medium">
            {t("تعذر التحقق من الجلسة", "Failed to verify session")}
          </p>
          <p className="text-sm text-[var(--ink-muted)] mt-2">
            {t(
              "يرجى محاولة تسجيل الدخول مرة أخرى",
              "Please try signing in again",
            )}
          </p>
          <Link
            href={`/${lang}/sign-in`}
            className="btn-primary mt-5 px-5 py-2.5"
          >
            {t("العودة لتسجيل الدخول", "Back to login")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <svg
          className="w-10 h-10 text-[var(--signal)] animate-spin mx-auto mb-4"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p
          className="text-[var(--ink-muted)] font-medium"
          role="status"
          aria-live="polite"
        >
          {t("جارٍ تسجيل دخولك...", "Signing you in...")}
        </p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  const { lang } = useLanguage();
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <svg
              className="w-10 h-10 text-[var(--signal)] animate-spin mx-auto mb-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p
              className="text-[var(--ink-muted)]"
              role="status"
              aria-live="polite"
            >
              {lang === "ar" ? "جارٍ التحميل..." : "Loading..."}
            </p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
