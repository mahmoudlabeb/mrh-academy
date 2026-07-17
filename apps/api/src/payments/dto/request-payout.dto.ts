import { IsNumber, Min, IsString, IsIn, MaxLength } from 'class-validator';

export class RequestPayoutDto {
  @IsNumber()
  @Min(10)
  amount: number;

  @IsString()
  @IsIn(['bank_transfer', 'paypal', 'vodafone_cash', 'instapay'])
  method: string;

  @IsString()
  @MaxLength(500)
  accountDetails: string;
}
