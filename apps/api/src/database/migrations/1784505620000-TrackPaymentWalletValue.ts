import { MigrationInterface, QueryRunner } from 'typeorm';

export class TrackPaymentWalletValue1784505620000
  implements MigrationInterface
{
  name = 'TrackPaymentWalletValue1784505620000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD COLUMN IF NOT EXISTS "credited_amount_usd" numeric(10,2)
    `);
    await queryRunner.query(`
      UPDATE "payments"
      SET "credited_amount_usd" = "amount"
      WHERE "credited_amount_usd" IS NULL
        AND UPPER("currency") = 'USD'
        AND "status" = 'approved'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments" DROP COLUMN IF EXISTS "credited_amount_usd"
    `);
  }
}
