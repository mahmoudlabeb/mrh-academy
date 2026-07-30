import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProfessionalCourseStudio1784505625000 implements MigrationInterface {
  name = 'ProfessionalCourseStudio1784505625000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses"
        ADD COLUMN IF NOT EXISTS "category" character varying(100),
        ADD COLUMN IF NOT EXISTS "thumbnail_public_id" character varying
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_sections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "course_id" uuid NOT NULL,
        "title" character varying(200) NOT NULL,
        "description" text,
        "section_order" integer NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "pk_course_sections" PRIMARY KEY ("id"),
        CONSTRAINT "fk_course_sections_course"
          FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_course_sections_course_id"
        ON "course_sections" ("course_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "course_lessons"
        ADD COLUMN IF NOT EXISTS "section_id" uuid,
        ADD COLUMN IF NOT EXISTS "video_url" text,
        ADD COLUMN IF NOT EXISTS "downloadable_files" jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "external_links" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_course_lessons_section_id"
        ON "course_lessons" ("section_id")
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'fk_course_lessons_section'
        ) THEN
          ALTER TABLE "course_lessons"
            ADD CONSTRAINT "fk_course_lessons_section"
            FOREIGN KEY ("section_id") REFERENCES "course_sections"("id")
            ON DELETE SET NULL;
        END IF;
      END
      $$
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "course_lessons"
        DROP CONSTRAINT IF EXISTS "fk_course_lessons_section",
        DROP COLUMN IF EXISTS "external_links",
        DROP COLUMN IF EXISTS "downloadable_files",
        DROP COLUMN IF EXISTS "video_url",
        DROP COLUMN IF EXISTS "section_id"
    `);
    await queryRunner.query('DROP TABLE IF EXISTS "course_sections"');
    await queryRunner.query(`
      ALTER TABLE "courses"
        DROP COLUMN IF EXISTS "thumbnail_public_id",
        DROP COLUMN IF EXISTS "category"
    `);
  }
}
