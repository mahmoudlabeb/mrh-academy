import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserNotificationPreferences1738000000001 implements MigrationInterface {
  name = 'AddUserNotificationPreferences1738000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "notificationPreferences" jsonb NOT NULL DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "notificationPreferences"
    `);
  }
}
