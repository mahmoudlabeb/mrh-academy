import { IsOptional, IsString, IsUUID } from 'class-validator';

export class EnrollCourseDto {
  @IsUUID()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsOptional()
  @IsString()
  referralCode?: string;
}
