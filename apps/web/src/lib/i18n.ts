'use client';

import ar from '../translations/ar.json';
import en from '../translations/en.json';
import { useLanguage } from '../contexts/language-context';

type Lang = 'ar' | 'en';

export const dict: Record<string, Record<Lang, string>> = {};
for (const [key, val] of Object.entries(ar)) {
  dict[key] = { ar: val, en: (en as Record<string, string>)[key] ?? val };
}
for (const [key, val] of Object.entries(en)) {
  if (!dict[key]) dict[key] = { ar: (ar as Record<string, string>)[key] ?? val, en: val };
}

export function translateError(errorMsg: string, lang: Lang = 'ar'): string {
  // If dict has exact match for the english/arabic error message
  if (dict[errorMsg]) {
    return dict[errorMsg][lang];
  }
  
  // Try to match lowercase/normalized
  const lowerMsg = errorMsg.toLowerCase();
  for (const [key, langs] of Object.entries(dict)) {
    if (key.toLowerCase() === lowerMsg || langs.en.toLowerCase() === lowerMsg) {
      return langs[lang];
    }
  }

  return errorMsg;
}

export function useT() {
  const { lang } = useLanguage();

  return (keyOrAr: string, enFallback?: string): string => {
    if (enFallback !== undefined) {
      return lang === 'ar' ? keyOrAr : enFallback;
    }
    return dict[keyOrAr]?.[lang] ?? keyOrAr;
  };
}
