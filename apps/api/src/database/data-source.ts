import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from '../common/database/snake-naming.strategy.js';

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
