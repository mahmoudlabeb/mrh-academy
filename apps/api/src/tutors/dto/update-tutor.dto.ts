import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { CourseStatus } from '@mrh/types';

export class UpdateTutorDto {
  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  specialization?: string;

  @IsArray()
  @IsOptional()
  languages?: string[];

  @IsNumber()
  @IsOptional()
  hourlyRate?: number;

  @IsString()
  @IsOptional()
  videoUrl?: string;

  @IsEnum(CourseStatus)
  @IsOptional()
  status?: CourseStatus;

  @IsString()
  @IsOptional()
  country?: string;

  @IsNumber()
  @Min(0)
  @Max(80)
  @IsOptional()
  experienceYears?: number;
}
