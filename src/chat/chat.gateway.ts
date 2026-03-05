import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  isEmailVerified: boolean;
}

interface ChatSocketUser {
  id: string;
  role: Role;
}

interface AuthenticatedSocket extends Socket {
  data: { user?: ChatSocketUser };
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
  ) {}

  afterInit() {
    this.logger.log('Chat gateway initialized');
  }

  handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.emit('chat.error', { message: 'Unauthorized: token missing' });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      client.data.user = { id: payload.sub, role: payload.role };
      this.logger.debug(`Socket connected: ${client.id} user=${payload.sub}`);
    } catch {
      client.emit('chat.error', { message: 'Unauthorized: invalid token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('chat.join')
  async onJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string },
  ) {
    const user = this.requireUser(client);
    const room = await this.chatService.getRoomByIdForUser(body.roomId, user);
    await client.join(this.getRoomChannel(room.id));
    client.emit('chat.joined', { roomId: room.id });
  }

  @SubscribeMessage('chat.leave')
  async onLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string },
  ) {
    await client.leave(this.getRoomChannel(body.roomId));
    client.emit('chat.left', { roomId: body.roomId });
  }

  @SubscribeMessage('chat.send')
  async onSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    body: { roomId: string; content: string; messageType?: string },
  ) {
    const user = this.requireUser(client);
    const message = await this.chatService.sendMessage(
      body.roomId,
      user.id,
      body.content,
      body.messageType || 'TEXT',
    );

    this.server
      .to(this.getRoomChannel(body.roomId))
      .emit('chat.message', message);
    return message;
  }

  @SubscribeMessage('chat.read')
  async onRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string },
  ) {
    const user = this.requireUser(client);
    const result = await this.chatService.markMessagesRead(body.roomId, user);
    this.server.to(this.getRoomChannel(body.roomId)).emit('chat.read', {
      roomId: body.roomId,
      readerId: user.id,
    });
    return result;
  }

  private extractToken(client: Socket): string | null {
    const authData: unknown = client.handshake.auth;
    const authToken =
      authData && typeof authData === 'object' && 'token' in authData
        ? (authData as { token?: unknown }).token
        : undefined;
    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return authToken.trim();
    }

    const headers: Record<string, unknown> = client.handshake.headers;
    const authHeader = headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length).trim();
    }

    return null;
  }

  private requireUser(client: AuthenticatedSocket): ChatSocketUser {
    const user = client.data.user;
    if (!user) {
      throw new Error('Unauthorized socket');
    }
    return user;
  }

  private getRoomChannel(roomId: string): string {
    return `chat:room:${roomId}`;
  }
}
