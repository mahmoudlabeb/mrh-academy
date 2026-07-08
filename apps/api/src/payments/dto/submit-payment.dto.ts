import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaymentMethod } from '@mrh/types';

export class SubmitPaymentDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsNumber()
  @Min(1)
  @Max(10000)
  amount: number;

  @IsOptional()
  @IsString()
  adminNote?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
