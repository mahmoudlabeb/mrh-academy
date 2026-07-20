import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module.js';
import { RedisService } from '../src/redis/redis.service.js';
import { RedisServiceMock } from './redis.mock.js';
import { EmailService } from '../src/integrations/email/email.service.js';
import { EmailServiceMock } from './email.mock.js';

jest.setTimeout(60000);

describe('Security Configuration (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useClass(RedisServiceMock)
      .overrideProvider(EmailService)
      .useClass(EmailServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.use(helmet());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Helmet Security Headers ──────────────────────────────────────────────────
  it('should include Helmet security headers (CSP, X-Frame-Options, HSTS)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200);

    // Content-Security-Policy header
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['content-security-policy']).toContain(
      "default-src 'self'",
    );

    // X-Frame-Options
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');

    // Strict-Transport-Security
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['strict-transport-security']).toContain(
      'max-age=31536000',
    );

    // X-Content-Type-Options
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  // ── Rate Limiting ────────────────────────────────────────────────────────────
  it('should enforce Rate Limiting (429 Too Many Requests)', async () => {
    let has429 = false;
    for (let attempt = 0; attempt < 110; attempt++) {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/health/live',
      );
      if (response.status === 429) {
        has429 = true;
        break;
      }
    }
    expect(has429).toBe(true);
  }, 30000);

  // ── Auth Guards ──────────────────────────────────────────────────────────────
  it('should return 401 for protected routes without a token', async () => {
    return request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });

  // ── DTO Whitelist (forbidNonWhitelisted) ─────────────────────────────────────
  it('should reject registration with unknown fields (forbidNonWhitelisted)', async () => {
    // Using a unique email to avoid conflict
    const uniqueEmail = `whitelist-${Date.now()}@test.com`;
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: uniqueEmail,
        password: 'Test-password-2026!',
        firstName: 'Valid',
        lastName: 'User',
        role: 'student',
        isAdmin: true, // unknown field — must be rejected
        maliciousField: 'xss', // unknown field — must be rejected
      })
      .expect(400);
  });

  // ── @MinLength(2) Validation ────────────────────────────────────────────────
  it('should reject registration with too-short firstName/lastName', async () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'shortname@test.com',
        password: 'Test-password-2026!',
        firstName: '', // too short
        lastName: 'X', // too short
        role: 'student',
      })
      .expect(400);
  });
});
