import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCourseCheckoutDto {
  @IsUUID()
  idempotencyKey: string;

  @IsUUID()
  courseId: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  referralCode?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ar', 'en'])
  returnLocale?: 'ar' | 'en';
}
