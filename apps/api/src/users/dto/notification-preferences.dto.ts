import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsBoolean()
  @IsOptional()
  email?: boolean;

  @IsBoolean()
  @IsOptional()
  sms?: boolean;

  @IsBoolean()
  @IsOptional()
  browser?: boolean;

  @IsBoolean()
  @IsOptional()
  lesson_reminders?: boolean;

  @IsBoolean()
  @IsOptional()
  new_messages?: boolean;

  @IsBoolean()
  @IsOptional()
  promotions?: boolean;

  @IsBoolean()
  @IsOptional()
  payment_updates?: boolean;
}
