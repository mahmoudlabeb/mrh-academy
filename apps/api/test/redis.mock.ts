export class RedisServiceMock {
  public connected = true;
  private readonly store = new Map<string, string>();

  set(key: string, value: string) {
    this.store.set(key, value);
  }

  get(key: string) {
    return this.store.get(key) ?? null;
  }

  del(key: string) {
    this.store.delete(key);
  }

  async delPattern(pattern: string) {
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
        return JSON.parse(cached);
      } catch {
        /* ignore */
      }
    }
    const value = await factory();
    this.store.set(key, JSON.stringify(value));
    return value;
  }
}
