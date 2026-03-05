import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ChatUserContext {
  id: string;
  role: Role;
}

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrGetCustomerRoom(customerId: string, initialMessage?: string) {
    let room = await this.prisma.supportChatRoom.findFirst({
      where: {
        customerId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        support: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!room) {
      room = await this.prisma.supportChatRoom.create({
        data: { customerId, status: 'OPEN' },
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          support: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });
    }

    if (initialMessage?.trim()) {
      await this.sendMessage(
        room.id,
        customerId,
        initialMessage.trim(),
        'TEXT',
      );
    }

    return this.getRoomByIdForUser(room.id, {
      id: customerId,
      role: Role.CUSTOMER,
    });
  }

  async listRoomsForUser(user: ChatUserContext) {
    if (user.role === Role.CUSTOMER) {
      return this.prisma.supportChatRoom.findMany({
        where: { customerId: user.id },
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          support: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          _count: { select: { messages: true } },
        },
        orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      });
    }

    return this.prisma.supportChatRoom.findMany({
      where: {
        OR: [{ supportId: user.id }, { supportId: null }],
      },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        support: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        _count: { select: { messages: true } },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async assignRoom(roomId: string, actor: ChatUserContext, supportId?: string) {
    this.ensureSupportRole(actor.role);

    const room = await this.prisma.supportChatRoom.findUnique({
      where: { id: roomId },
    });
    if (!room) throw new NotFoundException('Chat room not found');

    const targetSupportId = supportId ?? actor.id;
    const supportUser = await this.prisma.user.findUnique({
      where: { id: targetSupportId },
      select: { id: true, role: true },
    });
    if (!supportUser) throw new NotFoundException('Support user not found');
    if (!this.isSupportRole(supportUser.role)) {
      throw new BadRequestException('Assigned user is not support/admin');
    }

    return this.prisma.supportChatRoom.update({
      where: { id: roomId },
      data: { supportId: targetSupportId, status: 'IN_PROGRESS' },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        support: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async closeRoom(roomId: string, actor: ChatUserContext) {
    const room = await this.prisma.supportChatRoom.findUnique({
      where: { id: roomId },
    });
    if (!room) throw new NotFoundException('Chat room not found');

    if (actor.role === Role.CUSTOMER && room.customerId !== actor.id) {
      throw new ForbiddenException('You cannot close this room');
    }
    if (
      actor.role !== Role.CUSTOMER &&
      room.supportId &&
      room.supportId !== actor.id
    ) {
      this.ensureSupportRole(actor.role);
    }

    return this.prisma.supportChatRoom.update({
      where: { id: roomId },
      data: { status: 'CLOSED' },
    });
  }

  async getRoomByIdForUser(roomId: string, user: ChatUserContext) {
    const room = await this.prisma.supportChatRoom.findUnique({
      where: { id: roomId },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        support: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!room) throw new NotFoundException('Chat room not found');
    this.ensureRoomAccess(room, user);
    return room;
  }

  async getMessages(roomId: string, user: ChatUserContext) {
    await this.getRoomByIdForUser(roomId, user);
    return this.prisma.supportChatMessage.findMany({
      where: { roomId },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(
    roomId: string,
    senderId: string,
    content: string,
    messageType = 'TEXT',
  ) {
    const room = await this.prisma.supportChatRoom.findUnique({
      where: { id: roomId },
    });
    if (!room) throw new NotFoundException('Chat room not found');
    if (room.status === 'CLOSED')
      throw new BadRequestException('Chat room is closed');

    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { id: true, role: true },
    });
    if (!sender) throw new NotFoundException('Sender not found');

    this.ensureRoomAccess(room, { id: sender.id, role: sender.role });

    const message = await this.prisma.supportChatMessage.create({
      data: {
        roomId,
        senderId,
        content,
        messageType,
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });

    await this.prisma.supportChatRoom.update({
      where: { id: roomId },
      data: { lastMessageAt: message.createdAt },
    });

    return message;
  }

  async markMessagesRead(roomId: string, user: ChatUserContext) {
    await this.getRoomByIdForUser(roomId, user);
    await this.prisma.supportChatMessage.updateMany({
      where: {
        roomId,
        senderId: { not: user.id },
        isRead: false,
      },
      data: { isRead: true },
    });
    return { roomId, read: true };
  }

  private ensureSupportRole(role: Role): void {
    if (!this.isSupportRole(role)) {
      throw new ForbiddenException(
        'Only support/admin can perform this action',
      );
    }
  }

  private ensureRoomAccess(
    room: { customerId: string; supportId: string | null },
    user: ChatUserContext,
  ): void {
    if (user.role === Role.CUSTOMER) {
      if (room.customerId !== user.id) {
        throw new ForbiddenException('You cannot access this room');
      }
      return;
    }

    if (this.isSupportRole(user.role)) {
      if (
        room.supportId &&
        room.supportId !== user.id &&
        user.role === Role.SUPPORT
      ) {
        throw new ForbiddenException(
          'This room is assigned to another support agent',
        );
      }
      return;
    }

    throw new ForbiddenException('You cannot access this room');
  }

  private isSupportRole(role: Role): boolean {
    return (
      role === Role.SUPPORT || role === Role.ADMIN || role === Role.SUPER_ADMIN
    );
  }
}
