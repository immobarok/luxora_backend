import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { Roles, Role } from '../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('orders-cards')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async getOrderCards(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.dashboardService.getOrderCards(days);
  }

  @Get('overview')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async getOverview(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.dashboardService.getOverview(days);
  }
}
