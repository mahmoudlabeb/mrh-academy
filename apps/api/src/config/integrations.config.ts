import { registerAs } from '@nestjs/config';

export const integrationsConfig = registerAs('integrations', () => ({
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  },
}));
