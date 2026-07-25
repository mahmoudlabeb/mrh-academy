import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSocialLoginIdentities1784505609000 implements MigrationInterface {
  name = 'AddSocialLoginIdentities1784505609000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "facebook_id" varchar,
      ADD COLUMN IF NOT EXISTS "apple_id" varchar
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_facebook_id"
      ON "users" ("facebook_id")
      WHERE "facebook_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_apple_id"
      ON "users" ("apple_id")
      WHERE "apple_id" IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "payment_method_configs"
      SET "type" = 'vodafone'
      WHERE "type" = 'vodafone_cash'
        AND NOT EXISTS (
          SELECT 1 FROM "payment_method_configs" existing
          WHERE existing."type" = 'vodafone'
        )
    `);
    await queryRunner.query(`
      UPDATE "payment_method_configs"
      SET "type" = 'bank'
      WHERE "type" = 'bank_transfer'
        AND NOT EXISTS (
          SELECT 1 FROM "payment_method_configs" existing
          WHERE existing."type" = 'bank'
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_apple_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_facebook_id"`);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "apple_id",
      DROP COLUMN IF EXISTS "facebook_id"
    `);
  }
}
