import { IsInt, IsString, IsBoolean, Matches, Min, Max } from 'class-validator';

const TIME_24_HOUR_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export class CreateAvailabilityDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsString()
  @Matches(TIME_24_HOUR_PATTERN, {
    message: 'startTime must use 24-hour HH:mm format',
  })
  startTime: string;

  @IsString()
  @Matches(TIME_24_HOUR_PATTERN, {
    message: 'endTime must use 24-hour HH:mm format',
  })
  endTime: string;

  @IsBoolean()
  isRecurring: boolean;
}
