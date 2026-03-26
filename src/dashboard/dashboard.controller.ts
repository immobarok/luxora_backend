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

  @Get('top-selling-products')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async getTopSellingProducts(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('year') year?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const parsedYear = year ? Number(year) : undefined;
    return this.dashboardService.getTopSellingProducts(
      limit,
      parsedYear,
      categoryId,
    );
  }

  @Get('product-sales')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async getProductSales(
    @Query('year') year?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const parsedYear = year ? Number(year) : undefined;
    return this.dashboardService.getProductSales(parsedYear, categoryId);
  }

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
