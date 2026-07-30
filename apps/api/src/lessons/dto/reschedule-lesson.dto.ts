import { IsISO8601 } from 'class-validator';

export class RescheduleLessonDto {
  @IsISO8601({ strict: true })
  scheduledTime: string;
}
