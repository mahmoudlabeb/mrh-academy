import arabicReshaper from 'arabic-reshaper';
import bidi from 'bidi-js';

const ARABIC_RANGE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function isArabicText(text: string): boolean {
  return ARABIC_RANGE.test(text);
}

export function reshapeForPdf(text: string): string {
  if (!isArabicText(text)) return text;
  const reshaped = arabicReshaper(text);
  return bidi.getReorderedString(reshaped);
}
