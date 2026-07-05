import { IsInt, IsString, IsBoolean, Min, Max } from 'class-validator';

export class CreateAvailabilityDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsBoolean()
  isRecurring: boolean;
}
