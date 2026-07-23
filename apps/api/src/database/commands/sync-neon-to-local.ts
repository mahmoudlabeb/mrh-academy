import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { Client } from 'pg';

type TableSnapshot = {
  table: string;
  columns: string[];
  rows: Record<string, unknown>[];
};

function localEnvValue(name: string): string | undefined {
  const envPath = resolve(process.cwd(), '.env');
  const line = readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((value) => value.startsWith(`${name}=`));
  return line
    ?.slice(name.length + 1)
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function tableNames(client: Client): Promise<string[]> {
  const result = await client.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return result.rows.map((row) => row.table_name);
}

async function columnNames(client: Client, table: string): Promise<string[]> {
  const result = await client.query<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `,
    [table],
  );
  return result.rows.map((row) => row.column_name);
}

async function checksum(client: Client, table: string) {
  const quoted = quoteIdentifier(table);
  const result = await client.query<{ count: string; checksum: string }>(`
    SELECT
      count(*)::text AS count,
      md5(COALESCE(string_agg(to_jsonb(record)::text, '' ORDER BY to_jsonb(record)::text), '')) AS checksum
    FROM (SELECT * FROM ${quoted}) AS record
  `);
  return result.rows[0];
}

async function syncNeonToLocal() {
  if (process.env.CONFIRM_DATABASE_SYNC !== 'NEON_TO_LOCAL') {
    throw new Error(
      'Refusing to sync: set CONFIRM_DATABASE_SYNC=NEON_TO_LOCAL',
    );
  }
  const sourceUrl = process.env.DATABASE_URL || localEnvValue('DATABASE_URL');
  const targetUrl = process.env.LOCAL_DATABASE_URL;
  if (!sourceUrl || !targetUrl) {
    throw new Error('DATABASE_URL and LOCAL_DATABASE_URL are required');
  }
  const target = new URL(targetUrl);
  if (
    !['127.0.0.1', 'localhost'].includes(target.hostname) ||
    !/mrh_academy/i.test(target.pathname)
  ) {
    throw new Error(
      'LOCAL_DATABASE_URL must target a local MRH Academy database',
    );
  }
  if (sourceUrl === targetUrl)
    throw new Error('Source and target are identical');

  const source = new Client({ connectionString: sourceUrl });
  const destination = new Client({ connectionString: targetUrl });
  await Promise.all([source.connect(), destination.connect()]);

  try {
    const [sourceVersion, targetVersion, sourceTables, targetTables] =
      await Promise.all([
        source.query<{ version: string }>('SELECT version()'),
        destination.query<{ version: string }>('SELECT version()'),
        tableNames(source),
        tableNames(destination),
      ]);
    if (JSON.stringify(sourceTables) !== JSON.stringify(targetTables)) {
      throw new Error(
        `Schema table mismatch. Neon=${sourceTables.length}, local=${targetTables.length}`,
      );
    }

    const snapshots: TableSnapshot[] = [];
    for (const table of sourceTables) {
      const columns = await columnNames(source, table);
      const projection = columns
        .map(
          (column) =>
            `${quoteIdentifier(column)}::text AS ${quoteIdentifier(column)}`,
        )
        .join(', ');
      const rows = (
        await source.query<Record<string, unknown>>(
          `SELECT ${projection} FROM ${quoteIdentifier(table)}`,
        )
      ).rows;
      snapshots.push({
        table,
        columns,
        rows,
      });
    }

    const backupDir = resolve(process.cwd(), '../..', 'backups');
    mkdirSync(backupDir, { recursive: true });
    const backupPath = resolve(
      backupDir,
      `neon-before-local-sync-${new Date().toISOString().replaceAll(':', '-')}.json.gz`,
    );
    writeFileSync(
      backupPath,
      gzipSync(
        JSON.stringify({
          createdAt: new Date().toISOString(),
          sourceVersion: sourceVersion.rows[0].version,
          tables: snapshots,
        }),
      ),
      { mode: 0o600 },
    );

    await destination.query('BEGIN');
    try {
      await destination.query(`SET LOCAL session_replication_role = replica`);
      if (targetTables.length > 0) {
        await destination.query(
          `TRUNCATE TABLE ${targetTables.map(quoteIdentifier).join(', ')} RESTART IDENTITY CASCADE`,
        );
      }

      for (const snapshot of snapshots) {
        if (snapshot.rows.length === 0) continue;
        const columns = snapshot.columns.map(quoteIdentifier).join(', ');
        const quotedTable = quoteIdentifier(snapshot.table);
        for (const row of snapshot.rows) {
          const values = snapshot.columns.map((column) => row[column]);
          const placeholders = values
            .map((_, index) => `$${index + 1}`)
            .join(', ');
          await destination.query(
            `INSERT INTO ${quotedTable} (${columns}) VALUES (${placeholders})`,
            values,
          );
        }
      }

      const serialColumns = await destination.query<{
        table_name: string;
        column_name: string;
      }>(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_default LIKE 'nextval(%'
      `);
      for (const serial of serialColumns.rows) {
        const table = quoteIdentifier(serial.table_name);
        const column = quoteIdentifier(serial.column_name);
        await destination.query(`
          SELECT setval(
            pg_get_serial_sequence('${serial.table_name}', '${serial.column_name}'),
            COALESCE((SELECT max(${column}) FROM ${table}), 1),
            EXISTS(SELECT 1 FROM ${table})
          )
        `);
      }
      await destination.query('COMMIT');
    } catch (error) {
      await destination.query('ROLLBACK');
      throw error;
    }

    const verification = [];
    for (const table of sourceTables) {
      const [neon, local] = await Promise.all([
        checksum(source, table),
        checksum(destination, table),
      ]);
      verification.push({
        table,
        neonCount: Number(neon.count),
        localCount: Number(local.count),
        checksumMatch: neon.checksum === local.checksum,
      });
    }
    const mismatches = verification.filter(
      (row) => row.neonCount !== row.localCount || !row.checksumMatch,
    );
    const report = {
      direction: 'Neon -> local',
      generatedAt: new Date().toISOString(),
      neonVersion: sourceVersion.rows[0].version,
      localVersion: targetVersion.rows[0].version,
      backupPath,
      tableCount: sourceTables.length,
      mismatches,
      verification,
    };
    const serializedReport = JSON.stringify(report, null, 2);
    if (process.env.SYNC_EVIDENCE_PATH) {
      const evidencePath = resolve(process.env.SYNC_EVIDENCE_PATH);
      mkdirSync(resolve(evidencePath, '..'), { recursive: true });
      writeFileSync(evidencePath, `${serializedReport}\n`, { mode: 0o600 });
    }
    console.log(serializedReport);
    if (mismatches.length > 0) process.exitCode = 1;
  } finally {
    await Promise.allSettled([source.end(), destination.end()]);
  }
}

void syncNeonToLocal().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
