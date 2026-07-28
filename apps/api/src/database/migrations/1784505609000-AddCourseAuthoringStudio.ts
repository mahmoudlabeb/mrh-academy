import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourseAuthoringStudio1784505609000 implements MigrationInterface {
  name = 'AddCourseAuthoringStudio1784505609000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses"
        ADD COLUMN IF NOT EXISTS "course_type" character varying(20) NOT NULL DEFAULT 'recorded',
        ADD COLUMN IF NOT EXISTS "subtitle" character varying(240),
        ADD COLUMN IF NOT EXISTS "preview_video_url" text,
        ADD COLUMN IF NOT EXISTS "learning_outcomes" text,
        ADD COLUMN IF NOT EXISTS "requirements" text,
        ADD COLUMN IF NOT EXISTS "target_audience" text,
        ADD COLUMN IF NOT EXISTS "language" character varying(80) NOT NULL DEFAULT 'Arabic',
        ADD COLUMN IF NOT EXISTS "level" character varying(30) NOT NULL DEFAULT 'beginner',
        ADD COLUMN IF NOT EXISTS "timezone" character varying(80) NOT NULL DEFAULT 'Africa/Cairo',
        ADD COLUMN IF NOT EXISTS "capacity" integer,
        ADD COLUMN IF NOT EXISTS "cohort_start_at" timestamp,
        ADD COLUMN IF NOT EXISTS "cohort_end_at" timestamp,
        ADD COLUMN IF NOT EXISTS "is_draft" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "submitted_at" timestamp
    `);
    await queryRunner.query(`
      ALTER TABLE "course_lessons"
        ALTER COLUMN "video_asset_id" DROP NOT NULL,
        ADD COLUMN IF NOT EXISTS "description" text,
        ADD COLUMN IF NOT EXISTS "content_type" character varying(30) NOT NULL DEFAULT 'video',
        ADD COLUMN IF NOT EXISTS "article_content" text,
        ADD COLUMN IF NOT EXISTS "resource_url" text,
        ADD COLUMN IF NOT EXISTS "is_preview" boolean NOT NULL DEFAULT false
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "course_lessons"
        DROP COLUMN IF EXISTS "is_preview",
        DROP COLUMN IF EXISTS "resource_url",
        DROP COLUMN IF EXISTS "article_content",
        DROP COLUMN IF EXISTS "content_type",
        DROP COLUMN IF EXISTS "description"
    `);
    await queryRunner.query(`
      ALTER TABLE "courses"
        DROP COLUMN IF EXISTS "submitted_at",
        DROP COLUMN IF EXISTS "is_draft",
        DROP COLUMN IF EXISTS "cohort_end_at",
        DROP COLUMN IF EXISTS "cohort_start_at",
        DROP COLUMN IF EXISTS "capacity",
        DROP COLUMN IF EXISTS "timezone",
        DROP COLUMN IF EXISTS "level",
        DROP COLUMN IF EXISTS "language",
        DROP COLUMN IF EXISTS "target_audience",
        DROP COLUMN IF EXISTS "requirements",
        DROP COLUMN IF EXISTS "learning_outcomes",
        DROP COLUMN IF EXISTS "preview_video_url",
        DROP COLUMN IF EXISTS "subtitle",
        DROP COLUMN IF EXISTS "course_type"
    `);
  }
}
