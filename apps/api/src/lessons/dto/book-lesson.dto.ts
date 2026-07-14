import { IsUUID, IsISO8601, IsInt, Min, Max } from 'class-validator';

export class BookLessonDto {
  @IsUUID()
  tutorId: string;

  @IsISO8601({ strict: true })
  scheduledTime: string;

  @IsInt()
  @Min(30)
  @Max(240)
  durationMinutes: number;
}
