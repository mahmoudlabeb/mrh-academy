import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourseApprovalLifecycle1784505626000
  implements MigrationInterface
{
  name = 'AddCourseApprovalLifecycle1784505626000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "courses_status_enum_v2"
      AS ENUM ('draft', 'pending_review', 'active', 'rejected', 'archived')
    `);
    await queryRunner.query(`
      ALTER TABLE "courses"
        ALTER COLUMN "status" DROP DEFAULT,
        ALTER COLUMN "status" TYPE "courses_status_enum_v2"
          USING (
            CASE
              WHEN "is_draft" THEN 'draft'
              WHEN "status"::text = 'approved' THEN 'active'
              WHEN "status"::text = 'rejected' THEN 'rejected'
              ELSE 'pending_review'
            END
          )::"courses_status_enum_v2",
        ALTER COLUMN "status" SET DEFAULT 'draft',
        ADD COLUMN IF NOT EXISTS "reviewed_by" uuid,
        ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp,
        ADD COLUMN IF NOT EXISTS "review_decision" character varying(20),
        ADD COLUMN IF NOT EXISTS "review_note" text
    `);
    await queryRunner.query('DROP TYPE "courses_status_enum"');
    await queryRunner.query(
      'ALTER TYPE "courses_status_enum_v2" RENAME TO "courses_status_enum"',
    );
    await queryRunner.query(`
      ALTER TABLE "courses"
        ADD CONSTRAINT "fk_courses_reviewed_by"
        FOREIGN KEY ("reviewed_by") REFERENCES "users"("id")
        ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "courses"
        ADD CONSTRAINT "chk_courses_review_decision"
        CHECK ("review_decision" IS NULL OR "review_decision" IN ('approved', 'rejected'))
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_courses_review_queue"
      ON "courses" ("status", "submitted_at" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "idx_courses_review_queue"',
    );
    await queryRunner.query(`
      ALTER TABLE "courses"
        DROP CONSTRAINT IF EXISTS "chk_courses_review_decision",
        DROP CONSTRAINT IF EXISTS "fk_courses_reviewed_by",
        DROP COLUMN IF EXISTS "review_note",
        DROP COLUMN IF EXISTS "review_decision",
        DROP COLUMN IF EXISTS "reviewed_at",
        DROP COLUMN IF EXISTS "reviewed_by"
    `);
    await queryRunner.query(`
      CREATE TYPE "courses_status_enum_v1"
      AS ENUM ('pending', 'approved', 'rejected')
    `);
    await queryRunner.query(`
      ALTER TABLE "courses"
        ALTER COLUMN "status" DROP DEFAULT,
        ALTER COLUMN "status" TYPE "courses_status_enum_v1"
          USING (
            CASE
              WHEN "status"::text = 'active' THEN 'approved'
              WHEN "status"::text = 'rejected' THEN 'rejected'
              ELSE 'pending'
            END
          )::"courses_status_enum_v1",
        ALTER COLUMN "status" SET DEFAULT 'pending'
    `);
    await queryRunner.query('DROP TYPE "courses_status_enum"');
    await queryRunner.query(
      'ALTER TYPE "courses_status_enum_v1" RENAME TO "courses_status_enum"',
    );
  }
}
