import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from '../common/database/snake-naming.strategy.js';

(function loadEnv() {
  try {
    const envPath = resolve(__dirname, '../../.env');
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env not found, use existing process.env
  }
})();

const dbUrl = process.env.DATABASE_URL;
const nodeEnv = process.env.NODE_ENV ?? 'development';
const sslEnabled = process.env.DATABASE_SSL === 'true';
const sslRejectUnauthorized =
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...(dbUrl
    ? {
        url: dbUrl,
        ssl: sslEnabled ? { rejectUnauthorized: sslRejectUnauthorized } : false,
      }
    : {
        host: process.env.DATABASE_HOST ?? 'localhost',
        port: Number(process.env.DATABASE_PORT ?? 5432),
        username: process.env.DATABASE_USER ?? 'mrh_admin',
        password: process.env.DATABASE_PASSWORD ?? 'mrh_password_dev',
        database: process.env.DATABASE_NAME ?? 'mrh_academy_db',
        ssl: false,
      }),
  entities: ['dist/**/*.entity.js'],
  namingStrategy: new SnakeNamingStrategy(),
  migrations: ['dist/database/migrations/*.js'],
  synchronize: false,
  logging: nodeEnv !== 'production',
});
