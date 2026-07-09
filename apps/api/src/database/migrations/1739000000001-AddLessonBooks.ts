import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLessonBooks1739000000001 implements MigrationInterface {
  name = 'AddLessonBooks1739000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_books" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "lessonId" uuid NOT NULL,
        "uploadedBy" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "cloudinaryPublicId" character varying NOT NULL,
        "pageCount" integer NOT NULL DEFAULT 1,
        "mimeType" character varying(64) NOT NULL DEFAULT 'application/pdf',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lesson_books" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lesson_books_lesson" FOREIGN KEY ("lessonId")
          REFERENCES "lessons"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lesson_books_lessonId"
      ON "lesson_books" ("lessonId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lesson_books"`);
  }
}
