"use client";

import { useLanguage } from "@/contexts/language-context";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">
          {t("حدث خطأ ما", "Something went wrong")}
        </h1>
        <p className="mt-2">
          {t("يرجى المحاولة مرة أخرى.", "Please try again.")}
        </p>
        <button className="btn-primary mt-6 px-5 py-2" onClick={() => reset()}>
          {t("إعادة المحاولة", "Try again")}
        </button>
      </div>
    </main>
  );
}
