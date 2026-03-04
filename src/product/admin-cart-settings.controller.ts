import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { CartSettingsService } from '../cart/cart-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Request } from 'express';

class UpdateCartSettingsDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  @Type(() => Number)
  taxRate?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  freeShippingThreshold?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  shippingCost?: number;
}

interface RequestWithUser extends Request {
  user: { id: string };
}

@Controller('admin/cart-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminCartSettingsController {
  constructor(private readonly settingsService: CartSettingsService) {}

  @Get()
  async getSettings() {
    return this.settingsService.getSettingsWithMetadata();
  }

  @Patch()
  async updateSettings(
    @Body() dto: UpdateCartSettingsDto,
    @Req() req: RequestWithUser,
  ) {
    const updated = await this.settingsService.updateSettings(
      {
        TAX_RATE: dto.taxRate,
        FREE_SHIPPING_THRESHOLD: dto.freeShippingThreshold,
        SHIPPING_COST: dto.shippingCost,
      },
      req.user.id,
    );

    return {
      success: true,
      message: 'Cart settings updated successfully',
      data: updated,
    };
  }
}
