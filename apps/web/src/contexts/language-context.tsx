'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type Language = 'ar' | 'en';

interface LanguageContextType {
  lang: Language;
  dir: 'rtl' | 'ltr';
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getInitialLanguage(): Language {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('lang_pref') as Language | null;
    if (stored === 'ar' || stored === 'en') return stored;
    const navLangs = navigator.languages;
    if (navLangs && navLangs.some(l => l.startsWith('ar'))) return 'ar';
  }
  return 'ar';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(getInitialLanguage);
  const router = useRouter();
  const pathname = usePathname();

  const applyLanguage = useCallback((l: Language) => {
    const root = document.documentElement;
    const body = document.body;
    root.setAttribute('lang', l);
    root.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
    root.dataset.language = l;
    if (l === 'en') {
      body.classList.add('ltr');
    } else {
      body.classList.remove('ltr');
    }
    localStorage.setItem('lang_pref', l);
  }, []);

  const setLanguage = useCallback((l: Language) => {
    setLangState(l);
    applyLanguage(l);
  }, [applyLanguage]);

  const toggleLanguage = useCallback(() => {
    setLangState(prev => {
      const next: Language = prev === 'ar' ? 'en' : 'ar';
      applyLanguage(next);
      // The marketing homepage has a translated route; application pages are
      // shared and translate in place through this context.
      if (pathname === '/' && next === 'en') router.push('/en');
      if (pathname === '/en' && next === 'ar') router.push('/');
      return next;
    });
  }, [applyLanguage, pathname, router]);

  useEffect(() => {
    // Keep direct links and refreshes on the translated marketing route in
    // English, even when no language preference has been stored yet.
    if (pathname === '/en' && lang !== 'en') {
      setLangState('en');
      return;
    }
    applyLanguage(lang);
  }, [pathname, lang, applyLanguage]);

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ lang, dir, toggleLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
