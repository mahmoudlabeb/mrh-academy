import { IsUUID, IsString, MinLength, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  receiverId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}
