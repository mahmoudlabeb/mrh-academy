import {
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayNotEmpty,
  IsNumber,
  IsOptional,
  IsUrl,
  MinLength,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ApplyTutorDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(50)
  bio: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  specialization: string;

  @Transform(({ value }) => {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return value;
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  languages: string[];

  @Type(() => Number)
  @IsNumber()
  @Min(5)
  @Max(500)
  hourlyRate: number;

  @IsString()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  videoUrl?: string;
}
