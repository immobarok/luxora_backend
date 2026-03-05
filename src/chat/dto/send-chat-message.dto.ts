import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendChatMessageDto {
  @IsString()
  @MaxLength(2000)
  content!: string;

  @IsString()
  @IsOptional()
  messageType?: string;
}
