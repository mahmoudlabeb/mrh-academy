import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => {
  const url = process.env.DATABASE_URL;
  const rejectUnauthorized =
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';

  return {
    connection: url
      ? { url, ssl: { rejectUnauthorized } }
      : {
          host: process.env.DATABASE_HOST ?? 'localhost',
          port: Number(process.env.DATABASE_PORT ?? 5432),
          username: process.env.DATABASE_USER ?? 'mrh_admin',
          password: process.env.DATABASE_PASSWORD ?? 'mrh_password_dev',
          database: process.env.DATABASE_NAME ?? 'mrh_academy_db',
          ssl: false as const,
        },
  };
});
