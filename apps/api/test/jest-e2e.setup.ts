import supertest from 'supertest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

process.env.REFERRAL_SECRET ||=
  'e2e-referral-signing-secret-that-is-never-used-outside-tests';

const localDatabaseConfig = (() => {
  try {
    const values = new Map<string, string>();
    for (const rawLine of readFileSync(
      resolve(process.cwd(), '.env'),
      'utf8',
    ).split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const separator = line.indexOf('=');
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      const value = line
        .slice(separator + 1)
        .trim()
        .replace(/^(['"])(.*)\1$/, '$2');
      values.set(key, value);
    }
    return values;
  } catch {
    return new Map<string, string>();
  }
})();
const databaseUrl =
  process.env.DATABASE_URL ?? localDatabaseConfig.get('DATABASE_URL');
const databaseName = databaseUrl
  ? new URL(databaseUrl).pathname.slice(1)
  : (process.env.DATABASE_NAME ??
    localDatabaseConfig.get('DATABASE_NAME') ??
    '');
if (!/(test|e2e)/i.test(databaseName)) {
  throw new Error(
    `Refusing to run destructive API E2E tests against database "${databaseName || 'unspecified'}"; its name must contain "test" or "e2e".`,
  );
}

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
