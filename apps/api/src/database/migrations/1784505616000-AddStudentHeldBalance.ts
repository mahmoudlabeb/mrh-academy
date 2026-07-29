import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudentHeldBalance1784505616000 implements MigrationInterface {
  name = 'AddStudentHeldBalance1784505616000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "student_profiles"
        ADD COLUMN IF NOT EXISTS "held_balance" numeric(10, 2) NOT NULL DEFAULT 0
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "student_profiles"
        DROP COLUMN IF EXISTS "held_balance"
    `);
  }
}
