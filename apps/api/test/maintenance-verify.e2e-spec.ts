import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

describe('Maintenance Guard Verification (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let studentToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    dataSource = app.get(DataSource);

    // 1. Create a student and get token
    const studentRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `student-${Date.now()}@test.com`,
        password: 'Password123!',
        role: 'student',
        firstName: 'Test',
        lastName: 'Student',
      });
    studentToken = studentRes.body.accessToken;

    // 2. Create an admin and get token (we might need to manually set role to admin)
    const adminEmail = `admin-${Date.now()}@test.com`;
    const adminRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: adminEmail,
        password: 'Password123!',
        role: 'student', // register as student first
        firstName: 'Test',
        lastName: 'Admin',
      });
    
    // update to admin
    await dataSource.query(`UPDATE users SET role = 'admin' WHERE email = $1`, [adminEmail]);

    // login to get admin token
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: adminEmail,
        password: 'Password123!',
      });
    adminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('verifies maintenance mode behavior', async () => {
    // Enable maintenance mode
    await dataSource.query(
      `INSERT INTO settings (key, value) VALUES ('maintenance_mode', 'true') ON CONFLICT (key) DO UPDATE SET value = 'true'`
    );

    // Call non-admin endpoint with student token
    const studentRes = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${studentToken}`);
    
    console.log('Student Response (Maintenance ON):', studentRes.status, studentRes.body);

    // Call admin-authenticated endpoint with admin token
    const adminRes = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${adminToken}`);

    console.log('Admin Response (Maintenance ON):', adminRes.status, adminRes.body);

    // Disable maintenance mode
    await dataSource.query(
      `UPDATE settings SET value = 'false' WHERE key = 'maintenance_mode'`
    );

    // Call non-admin endpoint again
    const studentResAfter = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${studentToken}`);

    console.log('Student Response (Maintenance OFF):', studentResAfter.status, studentResAfter.body);
  });
});
