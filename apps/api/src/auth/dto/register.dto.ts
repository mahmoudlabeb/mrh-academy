import { IsEmail, IsString, MinLength, Matches, IsIn } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter and one digit',
  })
  password: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsIn(['student'], {
    message:
      'Public registration only creates student accounts. Use tutor onboarding to apply as a tutor.',
  })
  role: 'student';
}
