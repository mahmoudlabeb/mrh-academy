import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Legacy synchronized databases used upper-case payout status enum values,
 * while the shared contracts and current entities use lower-case values.
 */
export class NormalizePayoutStatusEnum1784505602000 implements MigrationInterface {
  name = 'NormalizePayoutStatusEnum1784505602000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [legacyValue, currentValue] of [
      ['PENDING', 'pending'],
      ['SUCCESS', 'success'],
      ['FAILED', 'failed'],
    ] as const) {
      await queryRunner.query(`
        DO $$ BEGIN
          IF EXISTS (
            SELECT 1
            FROM pg_enum enum_value
            JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
            WHERE enum_type.typname = 'payouts_status_enum'
              AND enum_value.enumlabel = '${legacyValue}'
          ) AND NOT EXISTS (
            SELECT 1
            FROM pg_enum enum_value
            JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
            WHERE enum_type.typname = 'payouts_status_enum'
              AND enum_value.enumlabel = '${currentValue}'
          ) THEN
            ALTER TYPE "payouts_status_enum"
              RENAME VALUE '${legacyValue}' TO '${currentValue}';
          END IF;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [currentValue, legacyValue] of [
      ['pending', 'PENDING'],
      ['success', 'SUCCESS'],
      ['failed', 'FAILED'],
    ] as const) {
      await queryRunner.query(`
        DO $$ BEGIN
          IF EXISTS (
            SELECT 1
            FROM pg_enum enum_value
            JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
            WHERE enum_type.typname = 'payouts_status_enum'
              AND enum_value.enumlabel = '${currentValue}'
          ) AND NOT EXISTS (
            SELECT 1
            FROM pg_enum enum_value
            JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
            WHERE enum_type.typname = 'payouts_status_enum'
              AND enum_value.enumlabel = '${legacyValue}'
          ) THEN
            ALTER TYPE "payouts_status_enum"
              RENAME VALUE '${currentValue}' TO '${legacyValue}';
          END IF;
        END $$;
      `);
    }
  }
}
