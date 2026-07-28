import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertCourseLessonDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(['video', 'article', 'resource'])
  contentType?: 'video' | 'article' | 'resource';

  @IsOptional()
  @IsString()
  @MaxLength(400)
  videoAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  articleContent?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  resourceUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  lessonOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPreview?: boolean;
}
