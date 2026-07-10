/**
 * Validates that all migrations apply cleanly to an empty PostgreSQL database.
 *
 * Usage (from apps/api):
 *   CONFIRM_VALIDATE=yes DATABASE_NAME=mrh_academy_migrate_test npm run migration:validate
 */
import { AppDataSource } from './data-source.js';

const EXPECTED_TABLES = [
  'users',
  'employees',
  'settings',
  'tutor_profiles',
  'student_profiles',
  'sub_admin_profiles',
  'tutor_availabilities',
  'lessons',
  'classrooms',
  'classroom_messages',
  'payments',
  'messages',
  'notifications',
  'courses',
  'course_lessons',
  'course_enrollments',
  'course_lesson_completions',
  'reviews',
  'teacher_training_articles',
  'reports',
  'vocabulary_words',
  'payouts',
  'course_promo_codes',
  'lesson_books',
  'student_favorites',
  'migrations',
];

async function validateMigrations() {
  if (process.env.CONFIRM_VALIDATE !== 'yes') {
    console.error('Refusing to validate: set CONFIRM_VALIDATE=yes');
    process.exit(1);
  }

  const dbName = process.env.DATABASE_NAME ?? 'mrh_academy_db';

  await AppDataSource.initialize();

  console.log(`Resetting public schema in database "${dbName}"...`);
  await AppDataSource.query('DROP SCHEMA public CASCADE');
  await AppDataSource.query('CREATE SCHEMA public');
  await AppDataSource.query('GRANT ALL ON SCHEMA public TO public');

  console.log('Running all migrations...');
  const executed = await AppDataSource.runMigrations();
  console.log(
    executed.length
      ? `Executed ${executed.length} migration(s): ${executed.map((m) => m.name).join(', ')}`
      : 'No migrations executed.',
  );

  const rows = await AppDataSource.query<{ table_name: string }[]>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const found = new Set(rows.map((r) => r.table_name));
  const missing = EXPECTED_TABLES.filter((t) => !found.has(t));
  const unexpected = [...found].filter((t) => !EXPECTED_TABLES.includes(t));

  if (missing.length > 0) {
    console.error('Missing tables:', missing.join(', '));
    process.exit(1);
  }

  if (unexpected.length > 0) {
    console.warn('Unexpected extra tables:', unexpected.join(', '));
  }

  console.log(`Validation passed: ${found.size} tables present.`);
  await AppDataSource.destroy();
}

validateMigrations().catch((err) => {
  console.error('Migration validation failed:', err);
  process.exit(1);
});
