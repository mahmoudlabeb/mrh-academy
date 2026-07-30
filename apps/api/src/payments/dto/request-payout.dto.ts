import {
  IsNumber,
  Min,
  IsString,
  IsIn,
  MaxLength,
  IsUUID,
  IsEmail,
  ValidateIf,
} from 'class-validator';

export class RequestPayoutDto {
  @IsUUID()
  idempotencyKey?: string;

  @IsNumber()
  @Min(10)
  amount: number;

  @IsString()
  @IsIn(['bank_transfer', 'paypal', 'vodafone_cash', 'instapay'])
  method: string;

  @IsString()
  @MaxLength(500)
  @ValidateIf((dto: RequestPayoutDto) => dto.method !== 'paypal')
  accountDetails?: string;

  @ValidateIf((dto: RequestPayoutDto) => dto.method === 'paypal')
  @IsEmail()
  paypalEmail?: string;
}
