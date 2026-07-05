import { IsString, IsOptional, IsBoolean, IsUrl, MinLength } from 'class-validator';

export class CreateArticleDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  @MinLength(10)
  content: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  coverImageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
