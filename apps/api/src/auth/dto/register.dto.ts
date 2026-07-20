import { IsEmail, IsString, MinLength, MaxLength, IsIn } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(15)
  @MaxLength(128)
  password: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsIn(['student', 'tutor'])
  role: 'student' | 'tutor';
}
