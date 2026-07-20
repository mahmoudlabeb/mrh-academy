import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class InviteSubAdminDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;
}

export class AcceptInviteDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(15)
  @MaxLength(128)
  password: string;
}
