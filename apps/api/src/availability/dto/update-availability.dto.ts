import {
  IsInt,
  IsString,
  IsBoolean,
  IsOptional,
  Matches,
  Min,
  Max,
} from 'class-validator';

const TIME_24_HOUR_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export class UpdateAvailabilityDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsString()
  @Matches(TIME_24_HOUR_PATTERN, {
    message: 'startTime must use 24-hour HH:mm format',
  })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_24_HOUR_PATTERN, {
    message: 'endTime must use 24-hour HH:mm format',
  })
  endTime?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}
