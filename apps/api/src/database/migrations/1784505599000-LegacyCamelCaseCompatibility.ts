import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Normalizes databases that were created by the legacy TypeORM synchronizer.
 * Those databases predate the migrations table and use camelCase identifiers.
 *
 * This migration intentionally runs immediately before InitialSchema so the
 * latter can safely add new tables, indexes, constraints, and seed data while
 * preserving all existing rows.
 */
export class LegacyCamelCaseCompatibility1784505599000 implements MigrationInterface {
  name = 'LegacyCamelCaseCompatibility1784505599000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        item record;
        snake_name text;
      BEGIN
        FOR item IN
          SELECT table_schema, table_name, column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND column_name <> lower(column_name)
        LOOP
          snake_name := lower(
            regexp_replace(item.column_name, '([a-z0-9])([A-Z])', '\\1_\\2', 'g')
          );

          IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = item.table_schema
              AND table_name = item.table_name
              AND column_name = snake_name
          ) THEN
            EXECUTE format(
              'ALTER TABLE %I.%I RENAME COLUMN %I TO %I',
              item.table_schema,
              item.table_name,
              item.column_name,
              snake_name
            );
          END IF;
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        item record;
        snake_name text;
      BEGIN
        FOR item IN
          SELECT ns.nspname AS table_schema, tbl.relname AS table_name, con.conname
          FROM pg_constraint con
          JOIN pg_class tbl ON tbl.oid = con.conrelid
          JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
          WHERE ns.nspname = 'public'
            AND con.conname <> lower(con.conname)
        LOOP
          snake_name := lower(
            regexp_replace(item.conname, '([a-z0-9])([A-Z])', '\\1_\\2', 'g')
          );
          IF snake_name <> item.conname THEN
            EXECUTE format(
              'ALTER TABLE %I.%I RENAME CONSTRAINT %I TO %I',
              item.table_schema,
              item.table_name,
              item.conname,
              snake_name
            );
          END IF;
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        item record;
        snake_name text;
      BEGIN
        FOR item IN
          SELECT schemaname, indexname
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname <> lower(indexname)
        LOOP
          snake_name := lower(
            regexp_replace(item.indexname, '([a-z0-9])([A-Z])', '\\1_\\2', 'g')
          );
          IF snake_name <> item.indexname THEN
            EXECUTE format(
              'ALTER INDEX %I.%I RENAME TO %I',
              item.schemaname,
              item.indexname,
              snake_name
            );
          END IF;
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "users"
        ADD COLUMN IF NOT EXISTS "invite_token" character varying,
        ADD COLUMN IF NOT EXISTS "invite_token_expires" TIMESTAMP;

      ALTER TABLE IF EXISTS "lessons"
        ADD COLUMN IF NOT EXISTS "room_id" character varying;

      ALTER TABLE IF EXISTS "payouts"
        ADD COLUMN IF NOT EXISTS "method" character varying(50),
        ADD COLUMN IF NOT EXISTS "account_details" text,
        ADD COLUMN IF NOT EXISTS "admin_note" text;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'system';
      EXCEPTION WHEN undefined_object THEN NULL;
      END $$;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Identifier normalization is intentionally not reversed: doing so would
    // make databases incompatible with every migration that follows this one.
  }
}
