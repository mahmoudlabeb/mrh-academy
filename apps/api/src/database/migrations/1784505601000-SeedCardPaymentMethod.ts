import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedCardPaymentMethod1784505601000 implements MigrationInterface {
  name = 'SeedCardPaymentMethod1784505601000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "payment_method_configs"
        ("type", "label", "enabled", "details", "sort_order")
      VALUES
        ('card', 'Credit Card', true, NULL, 0)
      ON CONFLICT ("type") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "payment_method_configs"
      WHERE "type" = 'card'
    `);
  }
}
