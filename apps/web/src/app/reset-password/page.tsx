"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { useLanguage } from "@/contexts/language-context";
import { apiClient } from "@/lib/api-client";

function ResetPasswordForm() {
  const { lang } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-bold mb-2 text-[var(--danger)]">
          {t("رابط غير صالح", "Invalid link")}
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          {t(
            "رابط استعادة كلمة المرور غير صالح أو انتهت صلاحيته.",
            "The password reset link is invalid or has expired.",
          )}
        </p>
        <Link href={`/${lang}/forgot-password`} className="btn-primary w-full">
          {t("طلب رابط جديد", "Request a new link")}
        </Link>
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError(t("كلمتا المرور غير متطابقتين", "Passwords do not match"));
      return;
    }

    setLoading(true);
    setError("");
    try {
      await apiClient.post("/auth/reset-password", { token, newPassword });
      setSuccess(true);
      setTimeout(() => router.push(`/${lang}/sign-in`), 3000);
    } catch (caughtError) {
      const requestError = caughtError as {
        response?: { data?: { message?: string } };
      };
      setError(
        requestError.response?.data?.message ||
          t("حدث خطأ. حاول مرة أخرى.", "Something went wrong. Try again."),
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center" role="status" aria-live="polite">
        <div
          className="w-16 h-16 rounded-full bg-[var(--success-soft)] flex items-center justify-center mx-auto mb-4 text-[var(--success)]"
          aria-hidden="true"
        >
          ✓
        </div>
        <h2 className="text-xl font-bold mb-2 text-[var(--success)]">
          {t("تم تغيير كلمة المرور بنجاح", "Password changed successfully")}
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          {t(
            "سيتم تحويلك إلى صفحة تسجيل الدخول…",
            "Redirecting to the sign-in page…",
          )}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div
          role="alert"
          className="p-3 text-sm text-[var(--danger)] bg-[var(--danger-soft)] border border-[var(--danger)] rounded-lg"
        >
          {error}
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor="new-password" className="block text-sm font-semibold">
          {t("كلمة المرور الجديدة", "New password")}
        </label>
        <input
          id="new-password"
          name="newPassword"
          type="password"
          required
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="input-field"
          minLength={6}
        />
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="confirm-password"
          className="block text-sm font-semibold"
        >
          {t("تأكيد كلمة المرور", "Confirm password")}
        </label>
        <input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="input-field"
          minLength={6}
        />
      </div>
      <button
        type="submit"
        disabled={loading || !newPassword || !confirmPassword}
        className="btn-primary w-full mt-4"
      >
        {loading
          ? t("جارٍ التغيير…", "Changing…")
          : t("تغيير كلمة المرور", "Change password")}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-main)" }}
    >
      <Navbar />
      <div className="flex-1 flex items-center justify-center py-20 px-4">
        <main className="w-full max-w-md card p-8 mx-auto mt-16 animate-slide-up">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 gradient-text logo-font">
              MRH Academy
            </h1>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              {t("إعادة تعيين كلمة المرور", "Reset password")}
            </p>
          </div>
          <Suspense
            fallback={
              <div className="text-center p-4">
                {t("جارٍ التحميل…", "Loading…")}
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
