import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourseEarningHold1784505615000 implements MigrationInterface {
  name = 'AddCourseEarningHold1784505615000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "course_enrollments"
      ADD COLUMN "tutor_share_available_at" timestamp,
      ADD COLUMN "tutor_share_released_at" timestamp
    `);
    await queryRunner.query(`
      UPDATE "course_enrollments"
      SET "tutor_share_available_at" = "created_at",
          "tutor_share_released_at" = "created_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "course_enrollments"
      ALTER COLUMN "tutor_share_available_at" SET NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_course_enrollments_tutor_share_available_at"
      ON "course_enrollments" ("tutor_share_available_at")
      WHERE "tutor_share_released_at" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_course_enrollments_tutor_share_available_at"`,
    );
    await queryRunner.query(`
      ALTER TABLE "course_enrollments"
      DROP COLUMN "tutor_share_released_at",
      DROP COLUMN "tutor_share_available_at"
    `);
  }
}
