import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
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

  // CORS Configuration — must precede helmet to avoid header conflicts
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, origin?: boolean | string | RegExp | (string | RegExp)[]) => void) => {
      const allowedOrigins = [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  // Security Headers
  app.use(helmet());

  // Swagger OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('Mr.H Academy API')
    .setDescription('The Definitive 30-Day Master API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Start Server
  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 API Server running on port ${port}`);
}
bootstrap();
