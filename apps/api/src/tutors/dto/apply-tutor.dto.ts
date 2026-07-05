import { IsString, IsNotEmpty, IsArray, ArrayNotEmpty, IsNumber, IsOptional, IsUrl } from 'class-validator';

export class ApplyTutorDto {
  @IsString()
  @IsNotEmpty()
  bio: string;

  @IsString()
  @IsNotEmpty()
  specialization: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  languages: string[];

  @IsNumber()
  hourlyRate: number;

  @IsString()
  @IsOptional()
  @IsUrl()
  videoUrl?: string;
}
