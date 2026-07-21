import { MigrationInterface, QueryRunner } from 'typeorm';

/** Applies the published course revenue split: tutor referral 98%, academy sale 47%. */
export class SetCourseCommissionRates1784505603000 implements MigrationInterface {
  name = 'SetCourseCommissionRates1784505603000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "settings" ("key", "value")
      VALUES
        ('course_tutor_promo_rate', '0.02'),
        ('course_academy_base_rate', '0.53')
      ON CONFLICT ("key") DO UPDATE
        SET "value" = EXCLUDED."value", "updated_at" = CURRENT_TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "settings"
      WHERE "key" IN ('course_tutor_promo_rate', 'course_academy_base_rate')
    `);
  }
}
