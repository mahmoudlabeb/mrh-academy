import { IsOptional, IsString } from 'class-validator';

export class EnrollCourseDto {
  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsOptional()
  @IsString()
  referralCode?: string;
}
