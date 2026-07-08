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

export class ApplyTutorDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(50)
  bio: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  specialization: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  languages: string[];

  @IsNumber()
  @Min(5)
  @Max(500)
  hourlyRate: number;

  @IsString()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  videoUrl?: string;
}
