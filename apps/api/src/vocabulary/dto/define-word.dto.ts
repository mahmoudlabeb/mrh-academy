import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class DefineWordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[^\p{Cc}{}<>]+$/u)
  word: string;

  @IsOptional()
  @IsString()
  @IsIn(['ar', 'en', 'fr', 'de', 'es', 'it', 'tr'])
  language?: string;
}
