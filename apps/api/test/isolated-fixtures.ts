import { randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hashPassword } from '../src/auth/password.js';
import { UserRole } from '@mrh/types';
import type { Repository } from 'typeorm';
import { User } from '../src/users/entities/user.entity.js';

const TEST_ORIGIN = 'http://localhost:3000';

export type IsolatedUserFixture = {
  user: User;
  password: string;
};

function cookieValue(setCookies: string | string[] | undefined, name: string) {
  const cookies = setCookies
    ? Array.isArray(setCookies)
      ? setCookies
      : [setCookies]
    : [];
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  if (!cookie) {
    throw new Error(`Expected ${name} cookie from the API`);
  }
  return cookie.slice(name.length + 1).split(';', 1)[0];
}

export async function createIsolatedUser(
  repository: Repository<User>,
  role: UserRole = UserRole.STUDENT,
): Promise<IsolatedUserFixture> {
  const password = `E2E-${randomBytes(24).toString('base64url')}`;
  const user = repository.create({
    email: `e2e-${randomUUID()}@mrh-academy.example`,
    firstName: 'Isolated',
    lastName: 'Fixture',
    passwordHash: await hashPassword(password),
    role,
    isVerified: true,
    isActive: true,
  });

  return { user: await repository.save(user), password };
}

export async function loginWithCookies(
  app: INestApplication,
  fixture: IsolatedUserFixture,
): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app.getHttpServer());
  const csrfResponse = await agent
    .get('/api/v1/auth/csrf')
    .set('Origin', TEST_ORIGIN)
    .expect(200);
  const csrfToken = cookieValue(csrfResponse.headers['set-cookie'], 'mrh_csrf');

  const loginResponse = await agent
    .post('/api/v1/auth/login')
    .set('Origin', TEST_ORIGIN)
    .set('X-CSRF-Token', csrfToken)
    .send({ email: fixture.user.email, password: fixture.password })
    .expect(200);

  cookieValue(loginResponse.headers['set-cookie'], 'mrh_token');
  return agent;
}
