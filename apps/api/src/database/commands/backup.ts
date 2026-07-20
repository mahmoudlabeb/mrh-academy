import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for db:backup`);
  return value;
}

const outputDirectory = resolve(
  process.env.DB_BACKUP_DIR ?? resolve(process.cwd(), 'backups'),
);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputPath = resolve(outputDirectory, `mrh-academy-${timestamp}.dump`);
mkdirSync(dirname(outputPath), { recursive: true });

const args = process.env.DATABASE_URL
  ? ['--format=custom', '--file', outputPath, required('DATABASE_URL')]
  : [
      '--format=custom',
      '--file',
      outputPath,
      '--host',
      process.env.DATABASE_HOST ?? 'localhost',
      '--port',
      process.env.DATABASE_PORT ?? '5432',
      '--username',
      process.env.DATABASE_USER ?? 'mrh_admin',
      '--dbname',
      process.env.DATABASE_NAME ?? 'mrh_academy_db',
    ];

const result = spawnSync('pg_dump', args, {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) throw result.error;
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Database backup written to ${outputPath}`);
