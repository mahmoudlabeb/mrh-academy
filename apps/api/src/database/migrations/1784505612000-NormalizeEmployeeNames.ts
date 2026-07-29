import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeEmployeeNames1784505612000 implements MigrationInterface {
  name = 'NormalizeEmployeeNames1784505612000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employees"
      ADD COLUMN IF NOT EXISTS "first_name" varchar NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS "last_name" varchar NOT NULL DEFAULT ''
    `);
    await queryRunner.query(`
      UPDATE "employees"
      SET
        "first_name" = split_part(trim(COALESCE("name", '')), ' ', 1),
        "last_name" = trim(
          substring(trim(COALESCE("name", ''))
          from length(split_part(trim(COALESCE("name", '')), ' ', 1)) + 1)
        )
      WHERE "first_name" = '' AND COALESCE("name", '') <> ''
    `);
    await queryRunner.query(
      'ALTER TABLE "employees" ALTER COLUMN "name" DROP NOT NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "employees"
      SET "name" = trim("first_name" || ' ' || "last_name")
      WHERE "name" IS NULL
    `);
    await queryRunner.query(
      'ALTER TABLE "employees" ALTER COLUMN "name" SET NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "employees" DROP COLUMN IF EXISTS "last_name"',
    );
    await queryRunner.query(
      'ALTER TABLE "employees" DROP COLUMN IF EXISTS "first_name"',
    );
  }
}
