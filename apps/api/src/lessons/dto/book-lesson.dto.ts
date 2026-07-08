import { IsUUID, IsDateString, IsInt, IsIn } from 'class-validator';

export class BookLessonDto {
  @IsUUID()
  tutorId: string;

  @IsDateString()
  scheduledTime: string;

  @IsInt()
  @IsIn([25, 50])
  durationMinutes: 25 | 50;
}
