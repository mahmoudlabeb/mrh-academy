import supertest from 'supertest';

const csrfToken = 'e2e-csrf-token';
const origin = 'http://localhost:3000';
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const testPrototype = supertest.Test.prototype as unknown as {
  end: (callback?: (error: unknown, response: unknown) => void) => unknown;
  method?: string;
  header?: Record<string, string>;
  set: (field: string, value: string) => unknown;
};
const originalEnd = testPrototype.end;

testPrototype.end = function patchedEnd(callback) {
  if (!safeMethods.has(this.method ?? '')) {
    const headers = this.header ?? {};
    if (!headers.origin) this.set('Origin', origin);
    if (!headers['x-csrf-token']) this.set('X-CSRF-Token', csrfToken);
    if (!headers.cookie) this.set('Cookie', `mrh_csrf=${csrfToken}`);
  }
  return originalEnd.call(this, callback);
};
