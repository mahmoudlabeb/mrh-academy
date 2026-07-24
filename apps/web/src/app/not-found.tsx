"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/language-context";

export default function NotFound() {
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2">
          {t("تعذر العثور على هذه الصفحة.", "This page could not be found.")}
        </p>
        <Link className="btn-primary inline-flex mt-6 px-5 py-2" href="/">
          {t("العودة للرئيسية", "Back home")}
        </Link>
      </div>
    </main>
  );
}
