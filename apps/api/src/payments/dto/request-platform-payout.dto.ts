import { IsEmail, IsNumber, IsUUID, Min } from 'class-validator';

export class RequestPlatformPayoutDto {
  @IsNumber()
  @Min(10)
  amount: number;

  @IsEmail()
  paypalEmail: string;

  @IsUUID()
  idempotencyKey: string;
}
