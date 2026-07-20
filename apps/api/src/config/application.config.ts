import { registerAs } from '@nestjs/config';

export const applicationConfig = registerAs('application', () => ({
  environment: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  platformCurrency: (process.env.PLATFORM_CURRENCY ?? 'usd').toLowerCase(),
  arabicPdfFontPath: process.env.ARABIC_PDF_FONT_PATH ?? '',
  referralSecret: process.env.REFERRAL_SECRET ?? process.env.JWT_SECRET ?? '',
  swaggerEnabled:
    process.env.SWAGGER_ENABLED === 'true' &&
    process.env.NODE_ENV !== 'production',
}));
