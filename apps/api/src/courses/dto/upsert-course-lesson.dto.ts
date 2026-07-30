import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  IsArray,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertCourseLessonDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

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
  @IsUrl({ require_tld: false })
  videoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  articleContent?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  resourceUrl?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({ require_tld: false }, { each: true })
  externalLinks?: string[];

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
