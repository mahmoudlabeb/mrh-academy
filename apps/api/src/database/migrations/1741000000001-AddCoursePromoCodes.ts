import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoursePromoCodes1741000000001 implements MigrationInterface {
  name = 'AddCoursePromoCodes1741000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_promo_codes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tutorId" uuid NOT NULL,
        "courseId" uuid NOT NULL,
        "code" character varying NOT NULL,
        "usageLimit" integer NOT NULL DEFAULT 100,
        "currentUses" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_course_promo_codes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_course_promo_codes_code" UNIQUE ("code")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_course_promo_codes_tutorId"
      ON "course_promo_codes" ("tutorId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_course_promo_codes_courseId"
      ON "course_promo_codes" ("courseId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "course_promo_codes"`);
  }
}
