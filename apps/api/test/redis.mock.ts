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
    // In mock, pattern match is naive (e.g. prefix match)
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
      }
    }
  }
}
