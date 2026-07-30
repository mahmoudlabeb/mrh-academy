import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaymentMethod } from '@mrh/types';

export class SubmitPaymentDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @Type(() => Number)
  @IsNumber()
  @Min(5)
  @Max(100000)
  amount: number;

  @IsOptional()
  @IsString()
  @IsIn(['USD', 'EGP'])
  currency?: 'USD' | 'EGP';

  @IsUUID()
  idempotencyKey: string;

  @IsOptional()
  @IsString()
  @IsIn(['ar', 'en'])
  returnLocale?: 'ar' | 'en';
}
