import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenSubAdminPermissions1784505605000 implements MigrationInterface {
  name = 'HardenSubAdminPermissions1784505605000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "sub_admin_profiles"
      SET "assigned_permissions" = ARRAY['manage_tutors','manage_students']::text[]
    `);
    await queryRunner.query(`
      UPDATE "employees"
      SET "permissions" = '["manage_tutors","manage_students"]'
      WHERE lower("email") IN (
        SELECT lower("email") FROM "users" WHERE "role" = 'subadmin'
      )
    `);
  }

  async down(): Promise<void> {
    // The removed privileged permissions cannot be restored safely.
  }
}
