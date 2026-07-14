import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUrl,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';

export class UpdateArticleDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @Transform(({ value }) =>
    value
      ? sanitizeHtml(value as string, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat([
            'img',
            'h1',
            'h2',
            'figure',
          ]),
          allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            img: ['src', 'alt', 'width', 'height'],
            a: ['href', 'target', 'rel'],
          },
        })
      : value,
  )
  content?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  coverImageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
