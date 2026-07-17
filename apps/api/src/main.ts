import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { checkSecurityEnvironment } from './common/security-check.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  checkSecurityEnvironment(logger);

  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global Prefix for API
  app.setGlobalPrefix('api/v1');

  // Validation Pipe — whitelist strips unknown properties silently
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS Configuration — strict lockdown in production
  const nodeEnv = process.env.NODE_ENV || 'development';
  const frontendUrl =
    process.env.FRONTEND_URL ||
    (nodeEnv === 'production' ? undefined : 'http://localhost:3000');

  const isOriginAllowed = (origin: string): boolean => {
    // Explicitly configured frontend URL
    if (frontendUrl && origin === frontendUrl) return true;
    // Allow localhost for development
    if (origin.startsWith('http://localhost')) return true;
    if (origin.startsWith('http://127.0.0.1')) return true;
    return false;
  };

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (
        err: Error | null,
        origin?: boolean | string | RegExp | (string | RegExp)[],
      ) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-MRH-Client',
    ],
  });

  // Security Headers
  app.use(
    helmet({
      crossOriginResourcePolicy: {
        policy: 'cross-origin',
      },
      contentSecurityPolicy:
        nodeEnv === 'production'
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", 'https://fonts.googleapis.com'],
                fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                imgSrc: [
                  "'self'",
                  'data:',
                  'https://res.cloudinary.com',
                  'https://randomuser.me',
                ],
                connectSrc: frontendUrl ? ["'self'", frontendUrl] : ["'self'"],
                mediaSrc: ["'self'", 'https://video.bunnycdn.com'],
                frameSrc: ["'self'", 'https://hooks.stripe.com'],
              },
            }
          : false,
    }),
  );

  // Swagger — disabled in production
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Mr.H Academy API')
      .setDescription('The Definitive 30-Day Master API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Start Server
  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 API Server running on port ${port}`);
}
bootstrap();
