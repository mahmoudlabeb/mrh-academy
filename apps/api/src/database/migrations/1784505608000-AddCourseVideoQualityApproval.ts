import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourseVideoQualityApproval1784505608000 implements MigrationInterface {
  name = 'AddCourseVideoQualityApproval1784505608000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses"
      ADD COLUMN IF NOT EXISTS "video_quality_approved_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "video_quality_approved_by" uuid
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses"
      DROP COLUMN IF EXISTS "video_quality_approved_by",
      DROP COLUMN IF EXISTS "video_quality_approved_at"
    `);
  }
}
