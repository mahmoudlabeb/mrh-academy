import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedRequiredPaymentSettings1784505607000 implements MigrationInterface {
  name = 'SeedRequiredPaymentSettings1784505607000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "settings" ("key", "value")
      VALUES
        ('egp_to_usd_rate', '50'),
        ('lesson_commission_tier_1_max_hours', '20'),
        ('lesson_commission_tier_1_rate', '0.30'),
        ('lesson_commission_tier_2_max_hours', '50'),
        ('lesson_commission_tier_2_rate', '0.24'),
        ('lesson_commission_tier_3_max_hours', '200'),
        ('lesson_commission_tier_3_rate', '0.20'),
        ('lesson_commission_tier_4_max_hours', '400'),
        ('lesson_commission_tier_4_rate', '0.18'),
        ('lesson_commission_tier_5_rate', '0.12')
      ON CONFLICT ("key") DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "payment_method_configs"
        ("type", "label", "enabled", "details", "sort_order")
      VALUES
        ('instapay', 'Instapay', false, NULL, 2),
        ('vodafone_cash', 'Vodafone Cash', false, NULL, 3)
      ON CONFLICT ("type") DO UPDATE
      SET "label" = EXCLUDED."label", "sort_order" = EXCLUDED."sort_order"
    `);
    // PayPal must remain unavailable until real API credentials are supplied.
    await queryRunner.query(`
      UPDATE "payment_method_configs"
      SET "enabled" = false
      WHERE "type" = 'paypal'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "settings"
      WHERE "key" = 'egp_to_usd_rate'
         OR "key" LIKE 'lesson_commission_tier_%'
    `);
    await queryRunner.query(`
      DELETE FROM "payment_method_configs"
      WHERE "type" IN ('instapay', 'vodafone_cash')
    `);
  }
}
