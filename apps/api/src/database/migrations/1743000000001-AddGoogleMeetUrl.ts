import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoogleMeetUrl1743000000001 implements MigrationInterface {
  name = 'AddGoogleMeetUrl1743000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lessons"
      ADD COLUMN IF NOT EXISTS "googleMeetUrl" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lessons"
      DROP COLUMN IF EXISTS "googleMeetUrl"
    `);
  }
}
