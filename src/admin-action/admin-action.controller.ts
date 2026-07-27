import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { AdminActionService } from './admin-action.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';

@Controller('admin-actions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN) // ONLY Super Admin can view audit logs
export class AdminActionController {
  constructor(private readonly adminActionService: AdminActionService) {}

  @Get()
  async getAuditLogs(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 100;
    const logs = await this.adminActionService.getAuditLogs(parsedLimit);
    return {
      success: true,
      data: logs,
    };
  }
}
