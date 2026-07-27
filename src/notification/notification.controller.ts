import { Controller, Get, Patch, Param, UseGuards, Req } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: { id: string; email: string; role: string };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getMyNotifications(@Req() req: RequestWithUser) {
    const notifications = await this.notificationService.getMyNotifications(req.user.id);
    return {
      success: true,
      data: notifications,
    };
  }

  @Patch('read-all')
  async markAllAsRead(@Req() req: RequestWithUser) {
    const result = await this.notificationService.markAllAsRead(req.user.id);
    return {
      success: true,
      message: `${result.count} notifications marked as read`,
    };
  }

  @Patch(':id/read')
  async markAsRead(@Req() req: RequestWithUser, @Param('id') id: string) {
    await this.notificationService.markAsRead(req.user.id, id);
    return {
      success: true,
      message: 'Notification marked as read',
    };
  }
}
