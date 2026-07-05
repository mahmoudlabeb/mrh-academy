import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator';

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
}
