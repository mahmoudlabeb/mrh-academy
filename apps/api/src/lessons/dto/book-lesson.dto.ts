import { IsUUID, IsISO8601, IsIn } from 'class-validator';

export class BookLessonDto {
  @IsUUID()
  tutorId: string;

  @IsISO8601({ strict: true })
  scheduledTime: string;

  @IsIn([25, 50])
  durationMinutes: number;
}
