import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLessonCalendarEventId1743000000002
  implements MigrationInterface
{
  name = 'AddLessonCalendarEventId1743000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "calendarEventId" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lessons" DROP COLUMN IF EXISTS "calendarEventId"`,
    );
  }
}
