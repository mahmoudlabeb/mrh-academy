import { AppDataSource } from './data-source.js';

async function runMigrations() {
  await AppDataSource.initialize();
  const executed = await AppDataSource.runMigrations();
  console.log(
    executed.length
      ? `Ran ${executed.length} migration(s): ${executed.map((m) => m.name).join(', ')}`
      : 'No pending migrations.',
  );
  await AppDataSource.destroy();
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
