import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTutorExperienceFields1784505613000 implements MigrationInterface {
  name = 'AddTutorExperienceFields1784505613000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tutor_profiles"
      ADD COLUMN IF NOT EXISTS "country" varchar,
      ADD COLUMN IF NOT EXISTS "experience_years" smallint
    `);
    await queryRunner.query(`
      ALTER TABLE "tutor_profiles"
      ADD CONSTRAINT "chk_tutor_experience_years"
      CHECK ("experience_years" IS NULL OR
        ("experience_years" >= 0 AND "experience_years" <= 80))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tutor_profiles"
      DROP CONSTRAINT IF EXISTS "chk_tutor_experience_years",
      DROP COLUMN IF EXISTS "experience_years",
      DROP COLUMN IF EXISTS "country"
    `);
  }
}
