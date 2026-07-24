"use client";

import { useEffect, useState } from "react";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [lang, setLang] = useState<"ar" | "en">("ar");

  useEffect(() => {
    setLang(localStorage.getItem("lang_pref") === "en" ? "en" : "ar");
  }, []);

  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
      <body>
        <main className="min-h-screen flex items-center justify-center p-6 text-center">
          <div>
            <h1>{t("خطأ في التطبيق", "Application error")}</h1>
            <button onClick={() => reset()}>
              {t("إعادة التحميل", "Reload")}
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
