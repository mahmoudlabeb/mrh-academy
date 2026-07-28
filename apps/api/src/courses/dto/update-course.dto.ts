import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsUrl({ require_tld: false })
  thumbnailUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  previewVideoUrl?: string;

  @IsOptional()
  @IsIn(['recorded', 'live'])
  courseType?: 'recorded' | 'live';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(240, { each: true })
  learningOutcomes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(240, { each: true })
  requirements?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(240, { each: true })
  targetAudience?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  language?: string;

  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced', 'all-levels'])
  level?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(500)
  capacity?: number;

  @IsOptional()
  @IsDateString()
  cohortStartAt?: string;

  @IsOptional()
  @IsDateString()
  cohortEndAt?: string;
}
