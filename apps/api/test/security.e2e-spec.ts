import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app.module.js';
import { RedisService } from '../src/redis/redis.service.js';
import { RedisServiceMock } from './redis.mock.js';

jest.setTimeout(60000);

describe('Security Configuration (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useClass(RedisServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
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
    const res = await request(app.getHttpServer()).get('/api/v1').expect(200);

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
    // Fire 105 requests in batches of 10 (limit is 100/min)
    for (let batch = 0; batch < 11; batch++) {
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app.getHttpServer())
            .get('/api/v1/health')
            .then((r) => r.status),
        );
      }
      const statuses = await Promise.all(promises);
      if (statuses.some((s) => s === 429)) {
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
        password: 'Test1234',
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
        password: 'Test1234',
        firstName: '', // too short
        lastName: 'X', // too short
        role: 'student',
      })
      .expect(400);
  });
});
