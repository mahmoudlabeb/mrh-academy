import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTutorAndCourseSecureVideos1784505621000 implements MigrationInterface {
  name = 'AddTutorAndCourseSecureVideos1784505621000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tutor_profiles"
      ADD COLUMN IF NOT EXISTS "intro_video_id" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "tutor_profiles"
      ADD COLUMN IF NOT EXISTS "intro_caption_languages" text
    `);
    await queryRunner.query(`
      ALTER TABLE "courses"
      ADD COLUMN IF NOT EXISTS "overview_video_id" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "courses"
      ADD COLUMN IF NOT EXISTS "overview_caption_languages" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "courses" DROP COLUMN IF EXISTS "overview_caption_languages"',
    );
    await queryRunner.query(
      'ALTER TABLE "courses" DROP COLUMN IF EXISTS "overview_video_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "tutor_profiles" DROP COLUMN IF EXISTS "intro_caption_languages"',
    );
    await queryRunner.query(
      'ALTER TABLE "tutor_profiles" DROP COLUMN IF EXISTS "intro_video_id"',
    );
  }
}
