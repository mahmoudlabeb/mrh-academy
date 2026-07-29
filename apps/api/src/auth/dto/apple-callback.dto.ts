import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AppleCallbackDto {
  @IsString()
  @MinLength(8)
  @MaxLength(4096)
  code: string;

  @IsString()
  @MinLength(8)
  @MaxLength(4096)
  state: string;

  @IsOptional()
  @IsString()
  @MaxLength(8192)
  id_token?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  user?: string;
}
