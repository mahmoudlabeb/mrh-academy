import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import cookieParser from 'cookie-parser';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/users/entities/user.entity.js';
import { RedisService } from '../src/redis/redis.service.js';
import { RedisServiceMock } from './redis.mock.js';
import { authenticateUser } from './isolated-fixtures.js';
import { EmailService } from '../src/integrations/email/email.service.js';
import { EmailServiceMock } from './email.mock.js';

describe('Maintenance Guard Verification (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let studentToken: string;
  let adminToken: string;

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
    await app.init();

    dataSource = app.get(DataSource);
    userRepository = app.get(getRepositoryToken(User));

    const studentEmail = `maintenance-student-${Date.now()}@mrh-academy.example`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: studentEmail,
        password: 'Test-password-2026!',
        role: 'student',
        firstName: 'Test',
        lastName: 'Student',
      })
      .expect(201);
    studentToken = (
      await authenticateUser(
        app,
        userRepository,
        studentEmail,
        'Test-password-2026!',
      )
    ).accessToken;

    const adminEmail = `maintenance-admin-${Date.now()}@mrh-academy.example`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: adminEmail,
        password: 'Test-password-2026!',
        role: 'student',
        firstName: 'Test',
        lastName: 'Admin',
      })
      .expect(201);

    await dataSource.query(`UPDATE users SET role = 'admin' WHERE email = $1`, [
      adminEmail,
    ]);
    adminToken = (
      await authenticateUser(
        app,
        userRepository,
        adminEmail,
        'Test-password-2026!',
      )
    ).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('verifies maintenance mode behavior', async () => {
    await dataSource.query(
      `INSERT INTO settings (key, value) VALUES ('maintenance_mode', 'true') ON CONFLICT (key) DO UPDATE SET value = 'true'`,
    );

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(503);

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await dataSource.query(
      `UPDATE settings SET value = 'false' WHERE key = 'maintenance_mode'`,
    );

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
  });
});
