import { Cairo, Plus_Jakarta_Sans, Inter, Tajawal } from 'next/font/google';

export const cairo = Cairo({
  subsets: ['arabic'],
  variable: '--font-cairo-arabic',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const tajawal = Tajawal({
  subsets: ['arabic'],
  variable: '--font-tajawal-arabic',
  display: 'swap',
  weight: ['400', '500', '700', '800'],
});

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '600', '700', '800'],
});
