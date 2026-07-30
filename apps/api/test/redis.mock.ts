export class RedisServiceMock {
  public connected = true;
  public readonly redis = { ping: async () => 'PONG' };
  private readonly store = new Map<string, string>();

  async set(key: string, value: string, _mode?: string, _ttl?: number) {
    this.store.set(key, value);
  }

  async setNX(
    key: string,
    value: string,
    _ttlSeconds: number,
  ): Promise<boolean> {
    if (this.store.has(key)) return false;
    this.store.set(key, value);
    return true;
  }

  async consumeRateLimit(
    key: string,
    limit: number,
    _windowSeconds: number,
  ): Promise<boolean> {
    const count = Number(this.store.get(key) ?? 0) + 1;
    this.store.set(key, String(count));
    return count <= limit;
  }

  get(key: string) {
    return this.store.get(key) ?? null;
  }

  del(key: string) {
    this.store.delete(key);
  }

  delPattern(pattern: string) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
      }
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    _ttlSeconds?: number,
  ): Promise<T> {
    const cached = this.store.get(key);
    if (cached !== undefined) {
      try {
        return JSON.parse(cached) as T;
      } catch {
        /* ignore */
      }
    }
    const value = await factory();
    this.store.set(key, JSON.stringify(value));
    return value;
  }
}
