import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPayouts1740000000001 implements MigrationInterface {
  name = 'AddPayouts1740000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payouts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tutorId" uuid NOT NULL,
        "amount" decimal(10,2) NOT NULL,
        "status" text NOT NULL DEFAULT 'PENDING',
        "stripePayoutId" character varying,
        "errorMessage" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payouts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payouts_tutorId"
      ON "payouts" ("tutorId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payouts"`);
  }
}
