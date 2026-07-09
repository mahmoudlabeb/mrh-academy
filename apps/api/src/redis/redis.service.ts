import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public readonly redis: Redis;
  public connected = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    this.redis.on('error', () => {});
  }

  async onModuleInit() {
    try {
      await this.redis.connect();
      await this.redis.ping();
      this.connected = true;
      this.logger.log('Redis connected');
    } catch {
      this.logger.warn('Redis unavailable — session enforcement disabled');
    }
  }

  async set(key: string, value: string, mode: 'EX', ttl: number) {
    if (!this.connected) return;
    await this.redis.set(key, value, mode, ttl);
  }

  async get(key: string) {
    if (!this.connected) return null;
    return this.redis.get(key);
  }

  async del(key: string) {
    if (!this.connected) return;
    await this.redis.del(key);
  }

  async delPattern(pattern: string) {
    if (!this.connected) return;
    const keys: string[] = [];
    let cursor = '0';
    do {
      const result = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number = 300, // 5 mins default
  ): Promise<T> {
    if (!this.connected) {
      return factory();
    }
    const cached = await this.get(key);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // ignore
      }
    }
    const value = await factory();
    await this.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    return value;
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
