import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public readonly redis: Redis;
  public connected = false;
  private fallbackCache = new Map<
    string,
    { value: string; expiresAt: number }
  >();

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
      this.logger.warn(
        'Redis unavailable — falling back to in-memory cache for session enforcement',
      );
    }
  }

  async set(key: string, value: string, mode: 'EX', ttl: number) {
    if (!this.connected) {
      this.fallbackCache.set(key, {
        value,
        expiresAt: Date.now() + ttl * 1000,
      });
      return;
    }
    try {
      await this.redis.set(key, value, mode, ttl);
    } catch (err) {
      this.logger.error('Redis set error', err);
      this.connected = false;
      this.fallbackCache.set(key, {
        value,
        expiresAt: Date.now() + ttl * 1000,
      });
    }
  }

  async get(key: string) {
    if (!this.connected) {
      const entry = this.fallbackCache.get(key);
      if (entry && entry.expiresAt > Date.now()) return entry.value;
      if (entry) this.fallbackCache.delete(key);
      return null;
    }
    try {
      return await this.redis.get(key);
    } catch (err) {
      this.logger.error('Redis get error', err);
      this.connected = false;
      return null;
    }
  }

  async del(key: string) {
    if (!this.connected) {
      this.fallbackCache.delete(key);
      return;
    }
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.error('Redis del error', err);
      this.connected = false;
    }
  }

  /** Atomic set-if-not-exists with TTL. Returns true if key was newly set. */
  async setNX(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    if (!this.connected) {
      const entry = this.fallbackCache.get(key);
      if (entry && entry.expiresAt > Date.now()) return false;
      this.fallbackCache.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
      return true;
    }
    try {
      const result = await this.redis.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (err) {
      this.logger.error('Redis setNX error', err);
      this.connected = false;
      return true; // fail-open theoretically, or could also fallback here
    }
  }

  async delPattern(pattern: string) {
    if (!this.connected) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      for (const key of this.fallbackCache.keys()) {
        if (regex.test(key)) {
          this.fallbackCache.delete(key);
        }
      }
      return;
    }
    try {
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
    } catch (err) {
      this.logger.error('Redis delPattern error', err);
      this.connected = false;
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number = 300, // 5 mins default
  ): Promise<T> {
    if (!this.connected) {
      const entry = this.fallbackCache.get(key);
      if (entry && entry.expiresAt > Date.now()) {
        try {
          return JSON.parse(entry.value);
        } catch {
          // ignore parse error
        }
      }
      if (entry) this.fallbackCache.delete(key);
      const value = await factory();
      this.fallbackCache.set(key, {
        value: JSON.stringify(value),
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
      return value;
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
