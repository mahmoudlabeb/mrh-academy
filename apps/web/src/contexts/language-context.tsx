'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

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

  const applyLanguage = useCallback((l: Language) => {
    const root = document.documentElement;
    const body = document.body;
    root.setAttribute('lang', l);
    root.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
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
      return next;
    });
  }, [applyLanguage]);

  useEffect(() => {
    applyLanguage(lang);
  }, [lang, applyLanguage]);

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
