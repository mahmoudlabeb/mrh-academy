"use client";

import { useLanguage } from "@/contexts/language-context";

export default function Loading() {
  const { lang } = useLanguage();
  const label = lang === "ar" ? "جارٍ التحميل" : "Loading";
  return (
    <main
      className="min-h-screen flex items-center justify-center"
      aria-label={label}
      aria-live="polite"
      role="status"
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
        style={{ borderColor: "var(--signal)", borderTopColor: "transparent" }}
      />
      <span className="sr-only">{label}</span>
    </main>
  );
}
