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
import { ChatService } from './chat.service';
import {
  AssignChatRoomDto,
  CreateChatRoomDto,
  SendChatMessageDto,
} from './dto';

interface RequestWithUser extends Request {
  user: { id: string; role: PrismaRole };
}

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('rooms')
  async getMyRooms(@Req() req: RequestWithUser) {
    return this.chatService.listRoomsForUser({
      id: req.user.id,
      role: req.user.role,
    });
  }

  @Post('rooms')
  @Roles(Role.CUSTOMER)
  async createCustomerRoom(
    @Req() req: RequestWithUser,
    @Body() dto: CreateChatRoomDto,
  ) {
    return this.chatService.createOrGetCustomerRoom(
      req.user.id,
      dto.initialMessage,
    );
  }

  @Get('rooms/:roomId')
  async getRoom(@Req() req: RequestWithUser, @Param('roomId') roomId: string) {
    return this.chatService.getRoomByIdForUser(roomId, {
      id: req.user.id,
      role: req.user.role,
    });
  }

  @Get('rooms/:roomId/messages')
  async getMessages(
    @Req() req: RequestWithUser,
    @Param('roomId') roomId: string,
  ) {
    return this.chatService.getMessages(roomId, {
      id: req.user.id,
      role: req.user.role,
    });
  }

  @Post('rooms/:roomId/messages')
  async sendMessage(
    @Req() req: RequestWithUser,
    @Param('roomId') roomId: string,
    @Body() dto: SendChatMessageDto,
  ) {
    return this.chatService.sendMessage(
      roomId,
      req.user.id,
      dto.content,
      dto.messageType || 'TEXT',
    );
  }

  @Patch('rooms/:roomId/read')
  async markRead(@Req() req: RequestWithUser, @Param('roomId') roomId: string) {
    return this.chatService.markMessagesRead(roomId, {
      id: req.user.id,
      role: req.user.role,
    });
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
      { id: req.user.id, role: req.user.role },
      dto.supportId,
    );
  }

  @Patch('rooms/:roomId/close')
  async closeRoom(
    @Req() req: RequestWithUser,
    @Param('roomId') roomId: string,
  ) {
    return this.chatService.closeRoom(roomId, {
      id: req.user.id,
      role: req.user.role,
    });
  }
}
