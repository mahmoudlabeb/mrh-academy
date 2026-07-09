import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudentFavorites1742000000001 implements MigrationInterface {
  name = 'AddStudentFavorites1742000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "student_favorites" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "studentId" uuid NOT NULL,
        "tutorId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_student_favorites" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_student_favorites_student_tutor" UNIQUE ("studentId", "tutorId"),
        CONSTRAINT "FK_student_favorites_student" FOREIGN KEY ("studentId")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_student_favorites_tutor" FOREIGN KEY ("tutorId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_student_favorites_studentId"
      ON "student_favorites" ("studentId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_student_favorites_tutorId"
      ON "student_favorites" ("tutorId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "student_favorites"`);
  }
}
