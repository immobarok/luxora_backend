import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Role as PrismaRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role, Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ChatService } from './chat.service';
import {
  AssignChatRoomDto,
  CreateChatRoomDto,
  SendChatMessageDto,
} from './dto';

interface RequestWithUser extends Request {
  user?: { id: string; role: PrismaRole };
  headers: import('http').IncomingHttpHeaders;
}

function getChatUser(req: RequestWithUser): import('./chat.service').ChatUserContext {
  const guestId = req.headers['x-guest-id'] as string;
  if (req.user) {
    return { id: req.user.id, role: req.user.role, guestId };
  }
  return { guestId, role: 'GUEST' };
}

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Public()
  @Get('rooms')
  async getMyRooms(@Req() req: RequestWithUser) {
    return this.chatService.listRoomsForUser(getChatUser(req));
  }

  @Public()
  @Post('rooms')
  async createCustomerRoom(
    @Req() req: RequestWithUser,
    @Body() dto: CreateChatRoomDto,
  ) {
    const user = getChatUser(req);
    return this.chatService.createOrGetCustomerRoom(
      user.id,
      user.guestId,
      dto.initialMessage,
    );
  }

  @Public()
  @Get('rooms/:roomId')
  async getRoom(@Req() req: RequestWithUser, @Param('roomId') roomId: string) {
    return this.chatService.getRoomByIdForUser(roomId, getChatUser(req));
  }

  @Public()
  @Get('rooms/:roomId/messages')
  async getMessages(
    @Req() req: RequestWithUser,
    @Param('roomId') roomId: string,
  ) {
    return this.chatService.getMessages(roomId, getChatUser(req));
  }

  @Public()
  @Post('rooms/:roomId/messages')
  async sendMessage(
    @Req() req: RequestWithUser,
    @Param('roomId') roomId: string,
    @Body() dto: SendChatMessageDto,
  ) {
    return this.chatService.sendMessage(
      roomId,
      getChatUser(req),
      dto.content,
      dto.messageType || 'TEXT',
    );
  }

  @Public()
  @Patch('rooms/:roomId/read')
  async markRead(@Req() req: RequestWithUser, @Param('roomId') roomId: string) {
    return this.chatService.markMessagesRead(roomId, getChatUser(req));
  }

  @Patch('rooms/:roomId/assign')
  @Roles(Role.SUPPORT, Role.ADMIN, Role.SUPER_ADMIN)
  async assignRoom(
    @Req() req: RequestWithUser,
    @Param('roomId') roomId: string,
    @Body() dto: AssignChatRoomDto,
  ) {
    return this.chatService.assignRoom(
      roomId,
      getChatUser(req),
      dto.supportId,
    );
  }

  @Public()
  @Patch('rooms/:roomId/close')
  async closeRoom(
    @Req() req: RequestWithUser,
    @Param('roomId') roomId: string,
  ) {
    return this.chatService.closeRoom(roomId, getChatUser(req));
  }
}
