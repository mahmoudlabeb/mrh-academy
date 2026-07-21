import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStripeRefundLedger1784505604000 implements MigrationInterface {
  name = 'AddStripeRefundLedger1784505604000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" character varying,
      ADD COLUMN IF NOT EXISTS "stripe_payment_intent_id" character varying,
      ADD COLUMN IF NOT EXISTS "allocated_amount" numeric(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "refunded_amount" numeric(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "refunded_at" TIMESTAMP
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_payments_stripe_checkout_session_id"
      ON "payments" ("stripe_checkout_session_id")
      WHERE "stripe_checkout_session_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_payments_stripe_payment_intent_id"
      ON "payments" ("stripe_payment_intent_id")
      WHERE "stripe_payment_intent_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_funding_allocations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "payment_id" uuid NOT NULL,
        "enrollment_id" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_course_funding_allocations" PRIMARY KEY ("id"),
        CONSTRAINT "uq_course_funding_payment_enrollment" UNIQUE ("payment_id", "enrollment_id"),
        CONSTRAINT "fk_course_funding_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_course_funding_enrollment" FOREIGN KEY ("enrollment_id") REFERENCES "course_enrollments"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_course_funding_payment_id" ON "course_funding_allocations" ("payment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_course_funding_enrollment_id" ON "course_funding_allocations" ("enrollment_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_refund_reversals" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "payment_id" uuid NOT NULL,
        "original_enrollment_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "course_id" uuid NOT NULL,
        "tutor_id" uuid NOT NULL,
        "sold_by" character varying(10) NOT NULL,
        "paid_amount" numeric(10,2) NOT NULL,
        "platform_fee" numeric(10,2) NOT NULL,
        "tutor_share" numeric(10,2) NOT NULL,
        "stripe_charge_id" character varying,
        "reversed_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_course_refund_reversals" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_course_refund_payment_id" ON "course_refund_reversals" ("payment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_course_refund_enrollment_id" ON "course_refund_reversals" ("original_enrollment_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "course_refund_reversals"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "course_funding_allocations"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_payments_stripe_payment_intent_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_payments_stripe_checkout_session_id"`,
    );
    await queryRunner.query(`
      ALTER TABLE "payments"
      DROP COLUMN IF EXISTS "refunded_at",
      DROP COLUMN IF EXISTS "refunded_amount",
      DROP COLUMN IF EXISTS "allocated_amount",
      DROP COLUMN IF EXISTS "stripe_payment_intent_id",
      DROP COLUMN IF EXISTS "stripe_checkout_session_id"
    `);
  }
}
