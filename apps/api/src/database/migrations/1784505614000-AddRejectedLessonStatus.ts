import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRejectedLessonStatus1784505614000 implements MigrationInterface {
  name = 'AddRejectedLessonStatus1784505614000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "lessons_status_enum" ADD VALUE IF NOT EXISTS 'rejected'`,
    );
  }

  async down(): Promise<void> {
    // PostgreSQL enum values cannot be safely removed while rows may use them.
  }
}
