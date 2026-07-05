import { IsEmail, IsNotEmpty } from 'class-validator';

export class ChangeEmailDto {
  @IsEmail()
  newEmail: string;

  @IsNotEmpty()
  password: string;
}
