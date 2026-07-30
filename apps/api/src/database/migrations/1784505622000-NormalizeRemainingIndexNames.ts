import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeRemainingIndexNames1784505622000 implements MigrationInterface {
  name = 'NormalizeRemainingIndexNames1784505622000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER INDEX IF EXISTS "IDX_users_facebook_id" RENAME TO "idx_users_facebook_id"',
    );
    await queryRunner.query(
      'ALTER INDEX IF EXISTS "IDX_users_apple_id" RENAME TO "idx_users_apple_id"',
    );
    await queryRunner.query(
      'ALTER INDEX IF EXISTS "IDX_course_enrollments_tutor_share_available_at" RENAME TO "idx_course_enrollments_tutor_share_available_at"',
    );
    await queryRunner.query(
      'ALTER INDEX IF EXISTS "IDX_lessons_idempotency_key" RENAME TO "idx_lessons_idempotency_key"',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER INDEX IF EXISTS "idx_lessons_idempotency_key" RENAME TO "IDX_lessons_idempotency_key"',
    );
    await queryRunner.query(
      'ALTER INDEX IF EXISTS "idx_course_enrollments_tutor_share_available_at" RENAME TO "IDX_course_enrollments_tutor_share_available_at"',
    );
    await queryRunner.query(
      'ALTER INDEX IF EXISTS "idx_users_apple_id" RENAME TO "IDX_users_apple_id"',
    );
    await queryRunner.query(
      'ALTER INDEX IF EXISTS "idx_users_facebook_id" RENAME TO "IDX_users_facebook_id"',
    );
  }
}
