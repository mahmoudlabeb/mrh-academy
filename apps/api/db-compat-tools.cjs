const { writeFileSync, mkdirSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { Client } = require('pg');

const config = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DATABASE_SSL === 'true'
          ? {
              rejectUnauthorized:
                process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
            }
          : false,
    }
  : {
      host: process.env.DATABASE_HOST || 'localhost',
      port: Number(process.env.DATABASE_PORT || 5432),
      user: process.env.DATABASE_USER || 'mrh_admin',
      password: process.env.DATABASE_PASSWORD || 'mrh_password_dev',
      database: process.env.DATABASE_NAME || 'mrh_academy_db',
    };

function snakeCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function backup(client) {
  const tables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const data = {};
  for (const { table_name: table } of tables.rows) {
    data[table] = (await client.query(`SELECT * FROM ${quoteIdentifier(table)}`)).rows;
  }
  const directory = resolve('backups');
  mkdirSync(directory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = resolve(directory, `mrh-academy-data-${timestamp}.json`);
  writeFileSync(output, JSON.stringify({ createdAt: new Date().toISOString(), data }));
  console.log(JSON.stringify({ output, tables: tables.rowCount }));
}

async function audit(client) {
  const source = readFileSync(
    resolve('src/database/migrations/1784505600000-InitialSchema.ts'),
    'utf8',
  );
  const expected = new Map();
  for (const match of source.matchAll(/CREATE TABLE IF NOT EXISTS "([^"]+)" \(([\s\S]*?)\n\s*\)/g)) {
    const columns = [...match[2].matchAll(/^\s*"([^"]+)"\s+/gm)].map((item) => item[1]);
    expected.set(match[1], new Set(columns));
  }

  const result = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);
  const actual = new Map();
  for (const row of result.rows) {
    const columns = actual.get(row.table_name) || new Set();
    columns.add(snakeCase(row.column_name));
    actual.set(row.table_name, columns);
  }

  const missing = {};
  for (const [table, columns] of expected) {
    if (!actual.has(table)) {
      missing[table] = ['<table>'];
      continue;
    }
    const absent = [...columns].filter((column) => !actual.get(table).has(column));
    if (absent.length) missing[table] = absent;
  }
  console.log(JSON.stringify({ missing }, null, 2));
}

(async () => {
  const client = new Client(config);
  await client.connect();
  if (process.argv[2] === 'backup') await backup(client);
  else if (process.argv[2] === 'audit') await audit(client);
  else throw new Error('Expected mode: backup or audit');
  await client.end();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
