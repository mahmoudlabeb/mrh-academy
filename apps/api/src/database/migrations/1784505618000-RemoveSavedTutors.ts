import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveSavedTutors1784505618000 implements MigrationInterface {
  name = 'RemoveSavedTutors1784505618000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "student_favorites"');
  }

  async down(): Promise<void> {
    // Retired user data cannot be reconstructed safely.
  }
}
