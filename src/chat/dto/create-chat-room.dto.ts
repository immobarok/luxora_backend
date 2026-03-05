import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateChatRoomDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  initialMessage?: string;
}
