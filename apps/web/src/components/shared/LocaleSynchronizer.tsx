"use client";

import { useEffect } from "react";
import { useLanguage } from "@/contexts/language-context";

export function LocaleSynchronizer({
  locale,
  children,
}: {
  locale: "en" | "ar";
  children: React.ReactNode;
}) {
  const { setLanguage } = useLanguage();
  useEffect(() => setLanguage(locale), [locale, setLanguage]);
  return (
    <div lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      {children}
    </div>
  );
}
