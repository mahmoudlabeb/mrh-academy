import { IsUUID, IsISO8601, IsIn } from 'class-validator';

export class BookLessonDto {
  @IsUUID()
  idempotencyKey?: string;

  @IsUUID()
  tutorId: string;

  @IsISO8601({ strict: true })
  scheduledTime: string;

  @IsIn([25, 50, 60, 120, 180, 240, 300, 360, 420, 480], {
    message:
      'durationMinutes must be a legacy 25/50 minute slot or a whole number of hours',
  })
  durationMinutes: number;
}
