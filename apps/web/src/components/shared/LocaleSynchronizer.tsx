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
  useEffect(() => {
    setLanguage(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale, setLanguage]);
  return children;
}
