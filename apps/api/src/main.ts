import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import {
  ConsoleLogger,
  Logger,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { checkSecurityEnvironment } from './common/security-check.js';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);
  checkSecurityEnvironment(logger, configService);
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.enableShutdownHooks();

  // Validation Pipe — whitelist strips unknown properties silently
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS Configuration — strict lockdown in production
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const frontendUrl = configService.get<string>('FRONTEND_URL');
  app.useLogger(new ConsoleLogger({ json: nodeEnv === 'production' }));

  const isOriginAllowed = (origin: string): boolean => {
    // Explicitly configured frontend URL
    if (frontendUrl && origin === frontendUrl) return true;
    // Allow localhost/127.0.0.1 ONLY in non-production environments
    if (nodeEnv !== 'production') {
      if (origin.startsWith('http://localhost')) return true;
      if (origin.startsWith('http://127.0.0.1')) return true;
    }
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
      'X-CSRF-Token',
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
  app.use(cookieParser());

  // Swagger — disabled in production
  if (
    nodeEnv !== 'production' &&
    configService.get<string>('SWAGGER_ENABLED') === 'true'
  ) {
    const config = new DocumentBuilder()
      .setTitle('Mr.H Academy API')
      .setDescription('Public HTTP contract for the Mr.H Academy platform')
      .setVersion('1')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/openapi.json',
    });
  }

  // Start Server
  const port = configService.get<number>('PORT', 4000);
  await app.listen(port);
  logger.log(`API server listening on port ${port}`);
}
bootstrap();
