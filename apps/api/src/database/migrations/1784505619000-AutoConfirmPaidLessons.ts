import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutoConfirmPaidLessons1784505619000 implements MigrationInterface {
  name = 'AutoConfirmPaidLessons1784505619000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "student_profiles" profile
      SET "held_balance" = GREATEST(
        0,
        profile."held_balance" - pending.total
      )
      FROM (
        SELECT "student_id", COALESCE(SUM("price"), 0) AS total
        FROM "lessons"
        WHERE "status"::text IN ('pending', 'rejected')
        GROUP BY "student_id"
      ) pending
      WHERE profile."user_id" = pending."student_id"
    `);
    await queryRunner.query(`
      UPDATE "lessons"
      SET "status" = 'cancelled'
      WHERE "status"::text IN ('pending', 'rejected')
    `);

    await queryRunner.query(`
      ALTER TABLE "lessons"
      ADD COLUMN IF NOT EXISTS "idempotency_key" character varying
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_lessons_idempotency_key"
      ON "lessons" ("idempotency_key")
      WHERE "idempotency_key" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "lessons" ALTER COLUMN "status" DROP DEFAULT
    `);
    await queryRunner.query(`
      CREATE TYPE "lessons_status_enum_new"
      AS ENUM ('confirmed', 'completed', 'cancelled')
    `);
    await queryRunner.query(`
      ALTER TABLE "lessons"
      ALTER COLUMN "status" TYPE "lessons_status_enum_new"
      USING "status"::text::"lessons_status_enum_new"
    `);
    await queryRunner.query(`DROP TYPE "lessons_status_enum"`);
    await queryRunner.query(`
      ALTER TYPE "lessons_status_enum_new" RENAME TO "lessons_status_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "lessons"
      ALTER COLUMN "status" SET DEFAULT 'confirmed'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lessons" ALTER COLUMN "status" DROP DEFAULT
    `);
    await queryRunner.query(`
      CREATE TYPE "lessons_status_enum_old"
      AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'rejected')
    `);
    await queryRunner.query(`
      ALTER TABLE "lessons"
      ALTER COLUMN "status" TYPE "lessons_status_enum_old"
      USING "status"::text::"lessons_status_enum_old"
    `);
    await queryRunner.query(`DROP TYPE "lessons_status_enum"`);
    await queryRunner.query(`
      ALTER TYPE "lessons_status_enum_old" RENAME TO "lessons_status_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "lessons"
      ALTER COLUMN "status" SET DEFAULT 'pending'
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_lessons_idempotency_key"`,
    );
    await queryRunner.query(`
      ALTER TABLE "lessons" DROP COLUMN IF EXISTS "idempotency_key"
    `);
  }
}
