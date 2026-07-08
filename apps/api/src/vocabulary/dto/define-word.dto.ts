import { IsOptional, IsString, MinLength } from 'class-validator';

export class DefineWordDto {
  @IsString()
  @MinLength(1)
  word: string;

  @IsOptional()
  @IsString()
  language?: string;
}
