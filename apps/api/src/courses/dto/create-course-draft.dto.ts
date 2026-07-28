import { IsIn } from 'class-validator';

export class CreateCourseDraftDto {
  @IsIn(['recorded', 'live'])
  courseType: 'recorded' | 'live';
}
