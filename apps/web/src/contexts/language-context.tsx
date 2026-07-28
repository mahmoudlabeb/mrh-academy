"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

type Language = "ar" | "en";

interface LanguageContextType {
  lang: Language;
  dir: "rtl" | "ltr";
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

function getInitialLanguage(): Language {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("lang_pref") as Language | null;
    if (stored === "ar" || stored === "en") return stored;
    const navLangs = navigator.languages;
    if (navLangs && navLangs.some((l) => l.startsWith("ar"))) return "ar";
  }
  return "ar";
}

function languageFromPath(pathname: string): Language | null {
  const segment = pathname.split("/").filter(Boolean)[0];
  return segment === "ar" || segment === "en" ? segment : null;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const initialPathname = useRef(pathname);
  // Keep the server and first client render deterministic. Browser preferences
  // are applied after hydration so persisted English cannot cause React to
  // discard server-rendered Arabic content.
  const [lang, setLangState] = useState<Language>(
    languageFromPath(pathname) ?? "ar",
  );
  const [hasHydrated, setHasHydrated] = useState(false);

  const applyLanguage = useCallback((l: Language) => {
    const root = document.documentElement;
    const body = document.body;
    root.setAttribute("lang", l);
    root.setAttribute("dir", l === "ar" ? "rtl" : "ltr");
    root.dataset.language = l;
    if (l === "en") {
      body.classList.add("ltr");
    } else {
      body.classList.remove("ltr");
    }
    localStorage.setItem("lang_pref", l);
    document.cookie = `lang_pref=${l}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, []);

  const setLanguage = useCallback(
    (l: Language) => {
      setLangState(l);
      applyLanguage(l);
    },
    [applyLanguage],
  );

  const toggleLanguage = useCallback(() => {
    const next: Language = lang === "ar" ? "en" : "ar";
    setLangState(next);
    applyLanguage(next);

    const routeLocale = languageFromPath(pathname);
    if (routeLocale) {
      const rest = pathname.split("/").slice(2).join("/");
      router.push(`/${next}${rest ? `/${rest}` : ""}`);
    }
  }, [applyLanguage, lang, pathname, router]);

  useEffect(() => {
    const initialLanguage =
      languageFromPath(initialPathname.current) ?? getInitialLanguage();
    setLangState(initialLanguage);
    applyLanguage(initialLanguage);
    setHasHydrated(true);
  }, [applyLanguage]);

  useEffect(() => {
    if (!hasHydrated) return;
    // Keep direct links and refreshes on the translated marketing route in
    // English, even when no language preference has been stored yet.
    const routeLanguage = languageFromPath(pathname);
    if (routeLanguage && lang !== routeLanguage) {
      setLangState(routeLanguage);
      applyLanguage(routeLanguage);
      return;
    }
    applyLanguage(lang);
  }, [pathname, lang, applyLanguage, hasHydrated]);

  const dir = lang === "ar" ? "rtl" : "ltr";

  return (
    <LanguageContext.Provider
      value={{ lang, dir, toggleLanguage, setLanguage }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx)
    throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
