import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { RedisService } from '../src/redis/redis.service';
import { RedisServiceMock } from './redis.mock';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
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
    await app.init();
  });

  it('exposes the public liveness health endpoint', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200)
      .expect({ status: 'ok', service: 'mrh-academy-api' });
  });

  afterEach(async () => {
    await app?.close();
  });
});
