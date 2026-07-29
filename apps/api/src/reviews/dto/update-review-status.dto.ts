import { IsEnum } from 'class-validator';
import { ReviewStatus } from '@mrh/types';

export class UpdateReviewStatusDto {
  @IsEnum(ReviewStatus)
  status: ReviewStatus;
}
