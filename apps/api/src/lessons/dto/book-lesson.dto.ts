import { IsUUID, IsISO8601, IsIn, IsOptional } from 'class-validator';

export class BookLessonDto {
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;

  @IsUUID()
  tutorId: string;

  @IsISO8601({ strict: true })
  scheduledTime: string;

  @IsIn([25, 50])
  durationMinutes: number;
}
