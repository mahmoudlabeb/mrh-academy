import { IsOptional, IsString } from 'class-validator';

export class CompleteLessonDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
