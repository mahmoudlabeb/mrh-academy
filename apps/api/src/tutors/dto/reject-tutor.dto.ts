import { IsString, IsNotEmpty } from 'class-validator';

export class RejectTutorDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
