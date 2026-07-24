"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";

export default function VerifyEmailPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [status, setStatus] = useState<
    "verifying" | "incomplete" | "verified" | "invalid"
  >("verifying");
  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("incomplete");
      return;
    }
    apiClient
      .post("/auth/verify-email", { token })
      .then(() => {
        setStatus("verified");
        setTimeout(() => router.push("/login"), 1200);
      })
      .catch(() => setStatus("invalid"));
  }, [params, router]);
  const messages = {
    verifying: t("جارٍ تأكيد بريدك الإلكتروني…", "Verifying your email…"),
    incomplete: t(
      "رابط التأكيد غير مكتمل.",
      "This verification link is incomplete.",
    ),
    verified: t(
      "تم تأكيد البريد. يمكنك تسجيل الدخول الآن.",
      "Email verified. You can now sign in.",
    ),
    invalid: t(
      "رابط التأكيد غير صالح أو انتهت صلاحيته.",
      "This verification link is invalid or expired.",
    ),
  };
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <p role="status">{messages[status]}</p>
    </main>
  );
}
