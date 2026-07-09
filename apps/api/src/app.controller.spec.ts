import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { Reflector } from '@nestjs/core';
import { RedisService } from './redis/redis.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        Reflector,
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => undefined) },
        },
        {
          provide: RedisService,
          useValue: {
            connected: false,
            redis: { ping: jest.fn(async () => 'PONG') },
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
