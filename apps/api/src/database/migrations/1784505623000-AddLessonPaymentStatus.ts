import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLessonPaymentStatus1784505623000 implements MigrationInterface {
  name = 'AddLessonPaymentStatus1784505623000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."lessons_payment_status_enum" AS ENUM('paid', 'refunded')`,
    );
    await queryRunner.query(
      `ALTER TABLE "lessons" ADD "payment_status" "public"."lessons_payment_status_enum" NOT NULL DEFAULT 'paid'`,
    );
    await queryRunner.query(
      `UPDATE "lessons" SET "payment_status" = 'refunded' WHERE "status" = 'cancelled'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lessons" DROP COLUMN "payment_status"`,
    );
    await queryRunner.query(`DROP TYPE "public"."lessons_payment_status_enum"`);
  }
}
