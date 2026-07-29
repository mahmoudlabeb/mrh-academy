import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveRetiredLearningTool1784505617000 implements MigrationInterface {
  name = 'RemoveRetiredLearningTool1784505617000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "vocabulary_words"');
  }

  async down(): Promise<void> {
    // Retired user data cannot be reconstructed safely.
  }
}
