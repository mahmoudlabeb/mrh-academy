import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

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
  country?: string;

  @IsNumber()
  @Min(0)
  @Max(80)
  @IsOptional()
  experienceYears?: number;
}
