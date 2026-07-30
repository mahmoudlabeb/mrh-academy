import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenPaidLearningLedger1784505624000 implements MigrationInterface {
  name = 'HardenPaidLearningLedger1784505624000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."payments_status_enum" ADD VALUE IF NOT EXISTS 'failed'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."payments_status_enum" ADD VALUE IF NOT EXISTS 'cancelled'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."payments_status_enum" ADD VALUE IF NOT EXISTS 'partially_refunded'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."payments_status_enum" ADD VALUE IF NOT EXISTS 'refunded'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."payments_status_enum" ADD VALUE IF NOT EXISTS 'disputed'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."payouts_status_enum" ADD VALUE IF NOT EXISTS 'processing'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."payouts_status_enum" ADD VALUE IF NOT EXISTS 'cancelled'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."payouts_status_enum" ADD VALUE IF NOT EXISTS 'refunded'`,
    );

    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "provider_status" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "disputed_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "idempotency_key" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "paypal_batch_id" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "paypal_item_id" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "provider_status" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "balance_restored_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payouts_idempotency_key" ON "payouts" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payouts_paypal_batch_id" ON "payouts" ("paypal_batch_id") WHERE "paypal_batch_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payouts_paypal_item_id" ON "payouts" ("paypal_item_id") WHERE "paypal_item_id" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "tutor_share" numeric(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "tutor_share_released_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `UPDATE "lessons" SET "tutor_share" = GREATEST(0, "price" - COALESCE("platform_fee", 0)) WHERE "platform_fee" IS NOT NULL AND "tutor_share" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "lessons" SET "tutor_share_released_at" = COALESCE("updated_at", NOW()) WHERE "status" = 'completed' AND "platform_fee" IS NOT NULL AND "tutor_share_released_at" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "lessons" DROP CONSTRAINT IF EXISTS "chk_lessons_duration_minutes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lessons" ADD CONSTRAINT "chk_lessons_duration_minutes" CHECK ("duration_minutes" IN (25, 50) OR ("duration_minutes" BETWEEN 60 AND 480 AND MOD("duration_minutes", 60) = 0))`,
    );

    await queryRunner.query(
      `ALTER TABLE "course_enrollments" ADD COLUMN IF NOT EXISTS "idempotency_key" uuid`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_course_enrollments_idempotency_key" ON "course_enrollments" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_funding_allocations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "payment_id" uuid NOT NULL,
        "lesson_id" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lesson_funding_allocations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_lesson_funding_payment_lesson" UNIQUE ("payment_id", "lesson_id"),
        CONSTRAINT "FK_lesson_funding_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_lesson_funding_lesson" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_lesson_funding_payment_id" ON "lesson_funding_allocations" ("payment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_lesson_funding_lesson_id" ON "lesson_funding_allocations" ("lesson_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_payouts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "requested_by" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "status" "public"."payouts_status_enum" NOT NULL DEFAULT 'pending',
        "receiver_email" character varying NOT NULL,
        "idempotency_key" uuid NOT NULL,
        "paypal_batch_id" character varying,
        "paypal_item_id" character varying,
        "provider_status" character varying,
        "error_message" text,
        "processed_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_payouts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_platform_payouts_idempotency" UNIQUE ("idempotency_key"),
        CONSTRAINT "UQ_platform_payouts_batch" UNIQUE ("paypal_batch_id"),
        CONSTRAINT "UQ_platform_payouts_item" UNIQUE ("paypal_item_id"),
        CONSTRAINT "FK_platform_payouts_admin" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_platform_payouts_requested_by" ON "platform_payouts" ("requested_by")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "platform_payouts"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "lesson_funding_allocations"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_course_enrollments_idempotency_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_enrollments" DROP COLUMN IF EXISTS "idempotency_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lessons" DROP CONSTRAINT IF EXISTS "chk_lessons_duration_minutes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lessons" ADD CONSTRAINT "chk_lessons_duration_minutes" CHECK ("duration_minutes" IN (25, 50))`,
    );
    await queryRunner.query(
      `ALTER TABLE "lessons" DROP COLUMN IF EXISTS "tutor_share_released_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lessons" DROP COLUMN IF EXISTS "tutor_share"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_payouts_paypal_item_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_payouts_paypal_batch_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_payouts_idempotency_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payouts" DROP COLUMN IF EXISTS "balance_restored_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payouts" DROP COLUMN IF EXISTS "processed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payouts" DROP COLUMN IF EXISTS "provider_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payouts" DROP COLUMN IF EXISTS "paypal_item_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payouts" DROP COLUMN IF EXISTS "paypal_batch_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payouts" DROP COLUMN IF EXISTS "idempotency_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP COLUMN IF EXISTS "disputed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP COLUMN IF EXISTS "provider_status"`,
    );
  }
}
