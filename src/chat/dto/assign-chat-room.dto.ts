import { IsOptional, IsString } from 'class-validator';

export class AssignChatRoomDto {
  @IsString()
  @IsOptional()
  supportId?: string;
}
