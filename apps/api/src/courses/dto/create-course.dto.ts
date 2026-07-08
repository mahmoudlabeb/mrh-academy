import { IsString, IsNumber, IsOptional, IsArray, Min, MaxLength } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(2000)
  description: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
