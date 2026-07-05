import { IsEnum } from 'class-validator';
import { CourseStatus } from '@mrh/types';

export class UpdateReviewStatusDto {
  @IsEnum(CourseStatus)
  status: CourseStatus;
}
