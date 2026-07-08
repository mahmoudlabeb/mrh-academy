import { IsOptional, IsString, IsIn } from 'class-validator';

export class EnrollCourseDto {
  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsOptional()
  @IsString()
  referralCode?: string;

  @IsOptional()
  @IsString()
  @IsIn(['tutor', 'academy'])
  soldBy?: 'tutor' | 'academy';
}
