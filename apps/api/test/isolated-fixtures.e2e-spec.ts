import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { RedisService } from '../src/redis/redis.service.js';
import { User } from '../src/users/entities/user.entity.js';
import { RedisServiceMock } from './redis.mock.js';
import { createIsolatedUser, loginWithCookies } from './isolated-fixtures.js';

describe('isolated browser authentication fixtures (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let fixture: Awaited<ReturnType<typeof createIsolatedUser>>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useClass(RedisServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    userRepository = app.get(getRepositoryToken(User));
    fixture = await createIsolatedUser(userRepository);
  });

  afterAll(async () => {
    if (fixture?.user.id) {
      await userRepository.delete(fixture.user.id);
    }
    await app?.close();
  });

  it('logs in a fresh verified user with HttpOnly cookies and CSRF protection', async () => {
    const agent = await loginWithCookies(app, fixture);
    const response = await agent
      .get('/api/v1/users/me')
      .set('Origin', 'http://localhost:3000')
      .expect(200);

    expect(response.body).toMatchObject({
      id: fixture.user.id,
      email: fixture.user.email,
      role: 'student',
    });
    expect(String(response.headers['set-cookie'] ?? '')).not.toContain(
      'mrh_token=',
    );
  });
});
