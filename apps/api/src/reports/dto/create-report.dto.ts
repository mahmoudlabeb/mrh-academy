import {
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateReportDto {
  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  issueType: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
