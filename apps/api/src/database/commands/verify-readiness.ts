import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { verify } from 'argon2';

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

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const value = localEnvValue('DATABASE_URL');
  if (!value) throw new Error('DATABASE_URL is not configured');
  return value;
}

async function verifyReadiness() {
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    const databaseIdentity = await client.query<{
      database: string;
      server_address: string | null;
      server_port: number;
      version: string;
    }>(`
      SELECT current_database() AS database,
             inet_server_addr()::text AS server_address,
             inet_server_port() AS server_port,
             version()
    `);
    const tableCounts = await client.query<{
      table_name: string;
      row_count: string;
    }>(`
      SELECT table_name,
             (xpath('/row/count/text()', query_to_xml(
               format('SELECT count(*) AS count FROM %I', table_name),
               false,
               true,
               ''
             )))[1]::text AS row_count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const subadmins = await client.query<{
      email: string;
      assigned_permissions: string[];
    }>(`
      SELECT u.email, s.assigned_permissions
      FROM sub_admin_profiles s
      JOIN users u ON u.id = s.user_id
      ORDER BY u.email
    `);
    const paypalColumns = await client.query<{
      column_name: string;
      data_type: string;
    }>(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'payments'
        AND column_name IN ('paypal_order_id', 'paypal_capture_id')
      ORDER BY column_name
    `);
    const migrations = await client.query<{ name: string }>(`
      SELECT name
      FROM migrations
      WHERE name IN (
        'HardenSubAdminPermissions1784505605000',
        'AddPayPalOrderLedger1784505606000',
        'SeedRequiredPaymentSettings1784505607000',
        'AddCourseVideoQualityApproval1784505608000'
      )
      ORDER BY name
    `);
    const paymentMethods = await client.query<{
      type: string;
      enabled: boolean;
      details_configured: boolean;
    }>(`
      SELECT type, enabled, details IS NOT NULL AND length(trim(details)) > 0 AS details_configured
      FROM payment_method_configs
      ORDER BY sort_order, type
    `);
    const paymentSettings = await client.query<{
      key: string;
      value: string;
    }>(`
      SELECT key, value
      FROM settings
      WHERE key = 'egp_to_usd_rate'
         OR key LIKE 'lesson_commission_tier_%'
      ORDER BY key
    `);
    const demoAdmin = await client.query<{ password_hash: string | null }>(`
      SELECT password_hash
      FROM users
      WHERE email = 'admin.one@mrh-academy.example'
      LIMIT 1
    `);
    const demoPassword = localEnvValue('DEMO_SEED_PASSWORD');
    const demoAdminPasswordMatchesConfiguredSeed = Boolean(
      demoPassword &&
      demoAdmin.rows[0]?.password_hash &&
      (await verify(demoAdmin.rows[0].password_hash, demoPassword)),
    );
    console.log(
      JSON.stringify(
        {
          databaseIdentity: databaseIdentity.rows[0],
          tableCounts: tableCounts.rows,
          subadmins: subadmins.rows,
          paypalColumns: paypalColumns.rows,
          paymentMethods: paymentMethods.rows,
          paymentSettings: paymentSettings.rows,
          demoAdminPasswordMatchesConfiguredSeed,
          migrations: migrations.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

void verifyReadiness().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
