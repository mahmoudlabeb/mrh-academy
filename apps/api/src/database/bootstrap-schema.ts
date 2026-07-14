/**
 * One-time bootstrap for an empty local database.
 * Usage: CONFIRM_BOOTSTRAP=yes npm run db:bootstrap
 */
import { AppDataSource } from './data-source.js';

async function bootstrap() {
  if (process.env.CONFIRM_BOOTSTRAP !== 'yes') {
    console.error('Refusing to bootstrap: set CONFIRM_BOOTSTRAP=yes');
    process.exit(1);
  }

  await AppDataSource.initialize();
  const [{ count }] = await AppDataSource.query(
    `SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );

  if (count > 0) {
    console.log(
      `Database already has ${count} table(s). Running migrations and forcing sync.`,
    );
    await AppDataSource.synchronize();
    const executed = await AppDataSource.runMigrations();
    console.log(
      executed.length
        ? `Ran ${executed.length} migration(s).`
        : 'No pending migrations.',
    );
  } else {
    console.log('Empty database detected — creating schema from entities...');
    await AppDataSource.synchronize();
    await AppDataSource.runMigrations();
    console.log('Schema bootstrap complete.');
  }

  await AppDataSource.destroy();
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
