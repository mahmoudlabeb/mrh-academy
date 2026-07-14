import { IsNumber, Min, IsString, IsIn } from 'class-validator';

export class RequestPayoutDto {
  @IsNumber()
  @Min(10)
  amount: number;

  @IsString()
  @IsIn(['bank_transfer', 'paypal', 'vodafone_cash', 'instapay'])
  method: string;

  @IsString()
  accountDetails: string;
}
