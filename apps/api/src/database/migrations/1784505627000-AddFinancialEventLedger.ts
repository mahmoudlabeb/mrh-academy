import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFinancialEventLedger1784505627000 implements MigrationInterface {
  name = 'AddFinancialEventLedger1784505627000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(`
      CREATE TYPE "public"."payments_status_enum_v2" AS ENUM (
        'pending',
        'succeeded',
        'failed',
        'cancelled',
        'partially_refunded',
        'refunded',
        'disputed'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "payments"
      ALTER COLUMN "status" TYPE "public"."payments_status_enum_v2"
      USING (
        CASE
          WHEN "status"::text = 'approved' THEN 'succeeded'
          WHEN "status"::text = 'rejected' THEN 'failed'
          ELSE "status"::text
        END
      )::"public"."payments_status_enum_v2"
    `);
    await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."payments_status_enum_v2" RENAME TO "payments_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `UPDATE "payment_method_configs" SET "enabled" = false WHERE "type" NOT IN ('card', 'paypal')`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "financial_ledger_entries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_key" character varying(255) NOT NULL,
        "transaction_type" character varying(50) NOT NULL,
        "status" character varying(40) NOT NULL,
        "provider" character varying(50) NOT NULL,
        "method" character varying(50) NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'USD',
        "user_id" uuid,
        "tutor_id" uuid,
        "payment_id" uuid,
        "course_id" uuid,
        "enrollment_id" uuid,
        "lesson_id" uuid,
        "payout_id" uuid,
        "provider_reference_id" character varying,
        "provider_status" character varying,
        "admin_commission" numeric(12,2) NOT NULL DEFAULT 0,
        "tutor_share" numeric(12,2) NOT NULL DEFAULT 0,
        "balance_before" numeric(12,2),
        "balance_after" numeric(12,2),
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "occurred_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_financial_ledger_entries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_financial_ledger_event_key" UNIQUE ("event_key"),
        CONSTRAINT "FK_financial_ledger_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_financial_ledger_tutor" FOREIGN KEY ("tutor_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_financial_ledger_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_financial_ledger_course" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_financial_ledger_enrollment" FOREIGN KEY ("enrollment_id") REFERENCES "course_enrollments"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_financial_ledger_lesson" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL
      )
    `);
    for (const column of [
      'transaction_type',
      'status',
      'user_id',
      'tutor_id',
      'payment_id',
      'course_id',
      'enrollment_id',
      'lesson_id',
      'payout_id',
      'provider_reference_id',
      'occurred_at',
    ]) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_financial_ledger_${column}" ON "financial_ledger_entries" ("${column}")`,
      );
    }

    await queryRunner.query(`
      INSERT INTO "financial_ledger_entries" (
        "event_key", "transaction_type", "status", "provider", "method",
        "amount", "currency", "user_id", "payment_id",
        "provider_reference_id", "provider_status", "occurred_at",
        "created_at", "updated_at", "metadata"
      )
      SELECT
        'payment:' || payment."id",
        CASE
          WHEN payment."admin_note" LIKE 'Direct course checkout:%'
            THEN 'course_purchase'
          ELSE 'wallet_top_up'
        END,
        payment."status"::text,
        CASE
          WHEN payment."method"::text = 'card' THEN 'stripe'
          WHEN payment."method"::text = 'paypal' THEN 'paypal'
          ELSE 'legacy_manual'
        END,
        payment."method"::text,
        payment."amount",
        payment."currency",
        payment."user_id",
        payment."id",
        COALESCE(
          payment."paypal_capture_id",
          payment."paypal_order_id",
          payment."stripe_payment_intent_id",
          payment."stripe_checkout_session_id"
        ),
        payment."provider_status",
        payment."created_at",
        payment."created_at",
        payment."updated_at",
        jsonb_build_object(
          'source', 'payment_backfill',
          'refundedAmount', COALESCE(payment."refunded_amount", 0)
        )
      FROM "payments" payment
      ON CONFLICT ("event_key") DO NOTHING
    `);

    await queryRunner.query(`
      UPDATE "financial_ledger_entries" ledger
      SET
        "tutor_id" = course."tutor_id",
        "course_id" = enrollment."course_id",
        "enrollment_id" = enrollment."id",
        "admin_commission" = COALESCE(enrollment."platform_fee", 0),
        "tutor_share" = COALESCE(enrollment."tutor_share", 0)
      FROM "payments" payment
      INNER JOIN "course_funding_allocations" allocation
        ON allocation."payment_id" = payment."id"
      INNER JOIN "course_enrollments" enrollment
        ON enrollment."id" = allocation."enrollment_id"
      INNER JOIN "courses" course
        ON course."id" = enrollment."course_id"
      WHERE ledger."payment_id" = payment."id"
        AND ledger."event_key" = 'payment:' || payment."id"
        AND payment."admin_note" LIKE 'Direct course checkout:%'
    `);

    await queryRunner.query(`
      INSERT INTO "financial_ledger_entries" (
        "event_key", "transaction_type", "status", "provider", "method",
        "amount", "currency", "user_id", "tutor_id", "course_id",
        "enrollment_id", "admin_commission", "tutor_share",
        "occurred_at", "created_at", "updated_at", "metadata"
      )
      SELECT
        'course_purchase:' || enrollment."id",
        'course_purchase',
        'succeeded',
        'internal',
        'wallet',
        COALESCE(enrollment."platform_fee", 0) + COALESCE(enrollment."tutor_share", 0),
        'USD',
        enrollment."student_id",
        course."tutor_id",
        enrollment."course_id",
        enrollment."id",
        COALESCE(enrollment."platform_fee", 0),
        COALESCE(enrollment."tutor_share", 0),
        enrollment."enrolled_at",
        enrollment."created_at",
        enrollment."updated_at",
        jsonb_build_object('source', 'course_enrollment_backfill')
      FROM "course_enrollments" enrollment
      INNER JOIN "courses" course ON course."id" = enrollment."course_id"
      WHERE NOT EXISTS (
        SELECT 1
        FROM "course_funding_allocations" allocation
        INNER JOIN "payments" payment ON payment."id" = allocation."payment_id"
        WHERE allocation."enrollment_id" = enrollment."id"
          AND payment."admin_note" LIKE 'Direct course checkout:%'
      )
      ON CONFLICT ("event_key") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "financial_ledger_entries" (
        "event_key", "transaction_type", "status", "provider", "method",
        "amount", "currency", "tutor_id", "course_id", "enrollment_id",
        "tutor_share", "occurred_at", "created_at", "updated_at", "metadata"
      )
      SELECT
        'tutor_earning:course:' || enrollment."id",
        'tutor_earning_release',
        'succeeded',
        'internal',
        'course_earnings',
        enrollment."tutor_share",
        'USD',
        course."tutor_id",
        enrollment."course_id",
        enrollment."id",
        enrollment."tutor_share",
        enrollment."tutor_share_released_at",
        enrollment."tutor_share_released_at",
        enrollment."updated_at",
        jsonb_build_object('source', 'course_earning_release_backfill')
      FROM "course_enrollments" enrollment
      INNER JOIN "courses" course ON course."id" = enrollment."course_id"
      WHERE enrollment."tutor_share_released_at" IS NOT NULL
        AND enrollment."tutor_share" > 0
      ON CONFLICT ("event_key") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "financial_ledger_entries" (
        "event_key", "transaction_type", "status", "provider", "method",
        "amount", "currency", "tutor_id", "lesson_id", "tutor_share",
        "occurred_at", "created_at", "updated_at", "metadata"
      )
      SELECT
        'tutor_earning:lesson:' || lesson."id",
        'tutor_earning_release',
        'succeeded',
        'internal',
        'lesson_earnings',
        lesson."tutor_share",
        'USD',
        lesson."tutor_id",
        lesson."id",
        lesson."tutor_share",
        lesson."tutor_share_released_at",
        lesson."tutor_share_released_at",
        lesson."updated_at",
        jsonb_build_object('source', 'lesson_earning_release_backfill')
      FROM "lessons" lesson
      WHERE lesson."tutor_share_released_at" IS NOT NULL
        AND lesson."tutor_share" > 0
      ON CONFLICT ("event_key") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "financial_ledger_entries" (
        "event_key", "transaction_type", "status", "provider", "method",
        "amount", "currency", "user_id", "tutor_id", "lesson_id",
        "admin_commission", "tutor_share", "occurred_at", "created_at",
        "updated_at", "metadata"
      )
      SELECT
        'lesson_booking:' || lesson."id",
        'lesson_booking',
        CASE
          WHEN lesson."payment_status"::text = 'refunded' THEN 'refunded'
          ELSE 'succeeded'
        END,
        'internal',
        'wallet',
        lesson."price",
        'USD',
        lesson."student_id",
        lesson."tutor_id",
        lesson."id",
        COALESCE(lesson."platform_fee", 0),
        COALESCE(lesson."tutor_share", 0),
        lesson."created_at",
        lesson."created_at",
        lesson."updated_at",
        jsonb_build_object('source', 'lesson_backfill')
      FROM "lessons" lesson
      ON CONFLICT ("event_key") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "financial_ledger_entries" (
        "event_key", "transaction_type", "status", "provider", "method",
        "amount", "currency", "tutor_id", "payout_id",
        "provider_reference_id", "provider_status", "occurred_at",
        "created_at", "updated_at", "metadata"
      )
      SELECT
        'tutor_payout:' || payout."id",
        'tutor_payout',
        CASE
          WHEN payout."status"::text = 'success' THEN 'succeeded'
          WHEN payout."status"::text = 'processing' THEN 'pending'
          ELSE payout."status"::text
        END,
        CASE
          WHEN payout."method" = 'stripe_connect' THEN 'stripe'
          WHEN payout."method" = 'paypal' THEN 'paypal'
          ELSE 'manual'
        END,
        COALESCE(payout."method", 'unknown'),
        payout."amount",
        'USD',
        payout."tutor_id",
        payout."id",
        COALESCE(
          payout."paypal_item_id",
          payout."paypal_batch_id",
          payout."stripe_payout_id"
        ),
        payout."provider_status",
        payout."created_at",
        payout."created_at",
        payout."updated_at",
        jsonb_build_object('source', 'tutor_payout_backfill')
      FROM "payouts" payout
      ON CONFLICT ("event_key") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "financial_ledger_entries" (
        "event_key", "transaction_type", "status", "provider", "method",
        "amount", "currency", "user_id", "payout_id",
        "provider_reference_id", "provider_status", "occurred_at",
        "created_at", "updated_at", "metadata"
      )
      SELECT
        'platform_payout:' || payout."id",
        'platform_payout',
        CASE
          WHEN payout."status"::text = 'success' THEN 'succeeded'
          WHEN payout."status"::text IN ('pending', 'processing') THEN 'pending'
          WHEN payout."status"::text = 'rejected' THEN 'failed'
          ELSE payout."status"::text
        END,
        'paypal',
        'paypal',
        payout."amount",
        'USD',
        payout."requested_by",
        payout."id",
        COALESCE(payout."paypal_item_id", payout."paypal_batch_id"),
        payout."provider_status",
        payout."created_at",
        payout."created_at",
        payout."updated_at",
        jsonb_build_object('source', 'platform_payout_backfill')
      FROM "platform_payouts" payout
      ON CONFLICT ("event_key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "financial_ledger_entries"`);
    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(`
      CREATE TYPE "public"."payments_status_enum_legacy" AS ENUM (
        'pending',
        'approved',
        'rejected',
        'failed',
        'cancelled',
        'partially_refunded',
        'refunded',
        'disputed'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "payments"
      ALTER COLUMN "status" TYPE "public"."payments_status_enum_legacy"
      USING (
        CASE
          WHEN "status"::text = 'succeeded' THEN 'approved'
          ELSE "status"::text
        END
      )::"public"."payments_status_enum_legacy"
    `);
    await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."payments_status_enum_legacy" RENAME TO "payments_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
  }
}
