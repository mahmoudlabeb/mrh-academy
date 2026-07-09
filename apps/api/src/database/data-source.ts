import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dbEntities from '../entities/index.js';

const dbUrl = process.env.DATABASE_URL;
const nodeEnv = process.env.NODE_ENV ?? 'development';
const sslRejectUnauthorized =
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...(dbUrl
    ? {
        url: dbUrl,
        ssl: { rejectUnauthorized: sslRejectUnauthorized },
      }
    : {
        host: process.env.DATABASE_HOST ?? 'localhost',
        port: Number(process.env.DATABASE_PORT ?? 5432),
        username: process.env.DATABASE_USER ?? 'mrh_admin',
        password: process.env.DATABASE_PASSWORD ?? 'mrh_password_dev',
        database: process.env.DATABASE_NAME ?? 'mrh_academy_db',
        ssl: false,
      }),
  entities: Object.values(dbEntities),
  migrations: ['dist/database/migrations/*.js'],
  synchronize: false,
  logging: nodeEnv !== 'production',
});
