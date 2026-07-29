import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminAuditLogs1784505611000 implements MigrationInterface {
  name = 'AddAdminAuditLogs1784505611000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "admin_id" uuid NOT NULL,
        "target_user_id" uuid,
        "action" varchar NOT NULL,
        "ip_address" varchar,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_admin_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "fk_admin_audit_logs_admin"
          FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_admin_audit_logs_target"
          FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_admin_audit_logs_admin_created"
      ON "admin_audit_logs" ("admin_id", "created_at" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "admin_audit_logs"');
  }
}
