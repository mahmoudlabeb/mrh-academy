import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPayPalOrderLedger1784505606000 implements MigrationInterface {
  name = 'AddPayPalOrderLedger1784505606000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD COLUMN IF NOT EXISTS "paypal_order_id" character varying,
      ADD COLUMN IF NOT EXISTS "paypal_capture_id" character varying
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_payments_paypal_order_id"
      ON "payments" ("paypal_order_id")
      WHERE "paypal_order_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_payments_paypal_capture_id"
      ON "payments" ("paypal_capture_id")
      WHERE "paypal_capture_id" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_payments_paypal_capture_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_payments_paypal_order_id"`,
    );
    await queryRunner.query(`
      ALTER TABLE "payments"
      DROP COLUMN IF EXISTS "paypal_capture_id",
      DROP COLUMN IF EXISTS "paypal_order_id"
    `);
  }
}
