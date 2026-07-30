import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveCourseSubmissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsBoolean()
  videoQualityApproved?: boolean;
}
